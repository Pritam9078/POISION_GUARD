/**
 * Deterministic in-memory chain implementing the EvmChainAdapter interface. TEST USE ONLY —
 * never registered by production wiring.
 */
import { ERC20, TRANSFER_TOPIC } from '../../src/adapters/chains/evm.js'
import { zeroPadValue } from 'ethers'

export class FakeChain {
  constructor(chainId = 1) {
    this.chainId = chainId; this.head = 1_000_000; this.transfers = []; this.allowances = new Map(); this.codes = new Map()
    this.txs = new Map(); this.receipts = new Map(); this.tokens = new Map(); this.approvalEvents = []
  }
  addToken(address, symbol, decimals = 18, name = symbol) { this.tokens.set(address.toLowerCase(), { symbol, decimals, name }); this.codes.set(address.toLowerCase(), '0x6000'); return this }
  addTransfer({ token, from, to, value, block = this.head - 10, txHash, txFrom }) {
    const h = txHash || '0x' + (this.transfers.length + 1).toString(16).padStart(64, 'a')
    this.transfers.push({ chainId: this.chainId, txHash: h, logIndex: this.transfers.length, blockNumber: BigInt(block), kind: 'erc20', token: token.toLowerCase(), from: from.toLowerCase(), to: to.toLowerCase(), value: String(value), timestamp: null, txFrom: null })
    this.txs.set(h, { hash: h, from: (txFrom || from).toLowerCase(), to: token, data: '0x', value: 0n })
    return h
  }
  setAllowance(token, owner, spender, amount, { block = this.head - 5 } = {}) {
    this.allowances.set(`${token}:${owner}:${spender}`.toLowerCase(), BigInt(amount))
    this.approvalEvents.push({ token: token.toLowerCase(), spender: spender.toLowerCase(), owner: owner.toLowerCase(), value: String(amount), txHash: '0x' + 'b'.repeat(63) + this.approvalEvents.length, blockNumber: BigInt(block) })
  }
  setCode(a, code) { this.codes.set(a.toLowerCase(), code) }
  /** Simulate a user-signed tx being mined. */
  mine({ hash, from, to, data = '0x', value = 0n, status = 1, logs = [] }) {
    this.txs.set(hash, { hash, from, to, data, value })
    this.receipts.set(hash, { hash, status, blockNumber: this.head - 10, logs, to, from })
  }
  erc20TransferLog(token, from, to, amount) {
    return { address: token, topics: [TRANSFER_TOPIC, zeroPadValue(from, 32), zeroPadValue(to, 32)], data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }
  }

  getChainInfo() { return { chainId: this.chainId, source: 'fake' } }
  async getBlockNumber() { return this.head }
  async getBlock(n) { return { number: n, timestamp: 1_700_000_000 } }
  async getTransaction(h) { return this.txs.get(h) ?? null }
  async getTransactionReceipt(h) { return this.receipts.get(h) ?? null }
  async getCode(a) { return this.codes.get(a.toLowerCase()) ?? '0x' }
  async estimateGas() { return 46000n }
  async getTokenMetadata(t) { const m = this.tokens.get(t.toLowerCase()); return { address: t, symbol: m?.symbol ?? null, name: m?.name ?? null, decimals: m?.decimals ?? null } }
  async getAllowance(token, owner, spender) { return this.allowances.get(`${token}:${owner}:${spender}`.toLowerCase()) ?? 0n }
  async getTransferHistory(address, { fromBlock, toBlock }) {
    const a = address.toLowerCase()
    return this.transfers.filter((t) => (t.from === a || t.to === a) && t.blockNumber >= BigInt(fromBlock) && t.blockNumber <= BigInt(toBlock)).map((t) => ({ ...t }))
  }
  async getApprovalHistory(owner) { return this.approvalEvents.filter((e) => e.owner === owner.toLowerCase()) }
}

export const fakeChainService = (chains) => ({ adapter: (id) => chains[id] ?? null, indexer: () => null })
