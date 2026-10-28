import { JsonRpcProvider, Interface, id as keccakId, zeroPadValue, Contract } from 'ethers'
import { env } from '../../config/env.js'
import { chainById } from '../../shared/chains.js'

export const TRANSFER_TOPIC = keccakId('Transfer(address,address,uint256)')
export const APPROVAL_TOPIC = keccakId('Approval(address,address,uint256)')
export const ERC20 = new Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])
const topicAddr = (a) => zeroPadValue(a, 32)
const fromTopic = (t) => '0x' + t.slice(26).toLowerCase()

function withTimeout(p, ms, label) {
  let t
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: 'TIMEOUT' })), ms) })]).finally(() => clearTimeout(t))
}

/**
 * Read-only EVM adapter over JSON-RPC (ethers v6). Never signs or broadcasts.
 * The same interface is implemented by the deterministic test adapter in tests/helpers.
 */
export class EvmChainAdapter {
  constructor(chain, rpcUrl) {
    this.chain = chain
    this.rpcUrl = rpcUrl
    // cacheTimeout -1: confirmation counting must never use a cached block height
    this.provider = new JsonRpcProvider(rpcUrl, chain.id, { staticNetwork: true, batchMaxCount: 10, cacheTimeout: -1 })
    this.timeout = 15000
  }
  getChainInfo() { return { chainId: this.chain.id, key: this.chain.key, name: this.chain.name, source: 'json-rpc' } }
  getBlockNumber() { return withTimeout(this.provider.getBlockNumber(), this.timeout, 'eth_blockNumber') }
  getBlock(n) { return withTimeout(this.provider.getBlock(n), this.timeout, 'eth_getBlockByNumber') }
  getTransaction(h) { return withTimeout(this.provider.getTransaction(h), this.timeout, 'eth_getTransactionByHash') }
  getTransactionReceipt(h) { return withTimeout(this.provider.getTransactionReceipt(h), this.timeout, 'eth_getTransactionReceipt') }
  getCode(a) { return withTimeout(this.provider.getCode(a), this.timeout, 'eth_getCode') }
  estimateGas(tx) { return withTimeout(this.provider.estimateGas(tx), this.timeout, 'eth_estimateGas') }
  getLogs(filter) { return withTimeout(this.provider.getLogs(filter), this.timeout * 2, 'eth_getLogs') }

  async getTokenMetadata(token) {
    const c = new Contract(token, ERC20, this.provider)
    const [symbol, name, decimals] = await Promise.all([
      withTimeout(c.symbol(), this.timeout, 'symbol').catch(() => null),
      withTimeout(c.name(), this.timeout, 'name').catch(() => null),
      withTimeout(c.decimals(), this.timeout, 'decimals').then(Number).catch(() => null),
    ])
    return { address: token.toLowerCase(), symbol, name, decimals }
  }
  async getAllowance(token, owner, spender, blockTag = 'latest') {
    const c = new Contract(token, ERC20, this.provider)
    return BigInt(await withTimeout(c.allowance(owner, spender, { blockTag }), this.timeout, 'allowance'))
  }

  /** Chunked log scan with adaptive range-halving when providers reject wide ranges. */
  async scanLogs(baseFilter, fromBlock, toBlock, chunk = env.SCAN_LOG_CHUNK) {
    const logs = []; let start = fromBlock; let size = chunk; let errors = 0
    while (start <= toBlock) {
      const end = Math.min(toBlock, start + size - 1)
      try {
        logs.push(...await this.getLogs({ ...baseFilter, fromBlock: start, toBlock: end }))
        start = end + 1
      } catch (e) {
        if (size > 10 && /range|limit|too many|exceed|10000|response size/i.test(e.message || '')) {
          size = Math.max(10, Math.floor(size / 2))
          // If forced down to minimal 10-block chunks by provider free-tier, only scan recent window to avoid thousands of roundtrips
          if (size <= 10 && (toBlock - start) > 500) {
            start = Math.max(start, toBlock - 200)
          }
          continue
        }
        if (++errors > 3) throw e
      }
    }
    return logs
  }

  /** ERC-20 Transfer logs where address is sender or recipient. Returns normalized transfers. */
  async getTransferHistory(address, { fromBlock, toBlock }) {
    if (this.rpcUrl.includes('alchemy.com')) {
      try {
        const hexFrom = '0x' + fromBlock.toString(16)
        const hexTo = '0x' + toBlock.toString(16)
        const [incoming, outgoing] = await Promise.all([
          this.provider.send('alchemy_getAssetTransfers', [{
            fromBlock: hexFrom, toBlock: hexTo, toAddress: address,
            category: ['erc20'], withMetadata: false, maxCount: '0x3e8'
          }]),
          this.provider.send('alchemy_getAssetTransfers', [{
            fromBlock: hexFrom, toBlock: hexTo, fromAddress: address,
            category: ['erc20'], withMetadata: false, maxCount: '0x3e8'
          }]),
        ])
        const all = [...(incoming?.transfers || []), ...(outgoing?.transfers || [])]
        const seen = new Set()
        const res = []
        for (const t of all) {
          const contractAddr = (t.rawContract?.address || '').toLowerCase()
          if (!contractAddr) continue
          const key = `${t.hash}:${contractAddr}`
          if (seen.has(key)) continue
          seen.add(key)
          res.push({
            chainId: this.chain.id,
            txHash: (t.hash || '').toLowerCase(),
            logIndex: 0,
            blockNumber: BigInt(t.blockNum),
            kind: 'erc20',
            token: contractAddr,
            from: (t.from || '').toLowerCase(),
            to: (t.to || '').toLowerCase(),
            value: (t.rawContract?.value ? BigInt(t.rawContract.value) : 0n).toString(),
            timestamp: null,
            txFrom: null,
          })
        }
        return res
      } catch (err) {
        // Fall back to standard eth_getLogs
      }
    }

    const a = topicAddr(address)
    const [out, inn] = await Promise.all([
      this.scanLogs({ topics: [TRANSFER_TOPIC, a] }, fromBlock, toBlock),
      this.scanLogs({ topics: [TRANSFER_TOPIC, null, a] }, fromBlock, toBlock),
    ])
    return [...out, ...inn].filter((l) => l.topics.length === 3).map((l) => ({
      chainId: this.chain.id, txHash: l.transactionHash.toLowerCase(), logIndex: l.index, blockNumber: BigInt(l.blockNumber),
      kind: 'erc20', token: l.address.toLowerCase(), from: fromTopic(l.topics[1]), to: fromTopic(l.topics[2]),
      value: (l.data && l.data !== '0x' ? BigInt(l.data) : 0n).toString(), timestamp: null, txFrom: null,
    }))
  }
  async getApprovalHistory(owner, { fromBlock, toBlock }) {
    const logs = await this.scanLogs({ topics: [APPROVAL_TOPIC, topicAddr(owner)] }, fromBlock, toBlock)
    return logs.filter((l) => l.topics.length === 3).map((l) => ({
      token: l.address.toLowerCase(), spender: fromTopic(l.topics[2]), value: (l.data && l.data !== '0x' ? BigInt(l.data) : 0n).toString(),
      txHash: l.transactionHash.toLowerCase(), blockNumber: BigInt(l.blockNumber),
    }))
  }
}

const cache = new Map()
/** Returns an adapter or null when no RPC is configured for that chain (callers must report "unavailable", never fake data). */
export function getEvmAdapter(chainId) {
  const chain = chainById(chainId)
  if (!chain) return null
  const url = env[chain.rpcEnvVar]
  if (!url) return null
  if (!cache.has(chain.id)) cache.set(chain.id, new EvmChainAdapter(chain, url))
  return cache.get(chain.id)
}
