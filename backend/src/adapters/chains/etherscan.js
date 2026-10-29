import { env } from '../../config/env.js'

/**
 * Etherscan V2 multichain indexer (single key, chainid param). Optional: gives full history
 * where plain RPC only covers a bounded block window. Responses are capped at `offset` rows.
 */
export class EtherscanIndexer {
  constructor(apiKey = env.ETHERSCAN_API_KEY, base = env.ETHERSCAN_API_URL) { this.apiKey = apiKey; this.base = base; this.max = 10000 }
  get configured() { return !!this.apiKey }
  async call(chainId, params) {
    const u = new URL(this.base)
    for (const [k, v] of Object.entries({ chainid: chainId, ...params, apikey: this.apiKey })) u.searchParams.set(k, String(v))
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000)
    try {
      const r = await fetch(u, { signal: ctl.signal })
      if (!r.ok) throw new Error(`Indexer HTTP ${r.status}`)
      const j = await r.json()
      if (j.status === '0' && !/No transactions found|No records found/i.test(j.message + ' ' + (typeof j.result === 'string' ? j.result : ''))) throw new Error(`Indexer error: ${typeof j.result === 'string' ? j.result : j.message}`)
      return Array.isArray(j.result) ? j.result : []
    } finally { clearTimeout(t) }
  }
  async getTokenTransfers(chainId, address) {
    const rows = await this.call(chainId, { module: 'account', action: 'tokentx', address, page: 1, offset: this.max, sort: 'desc' })
    return {
      truncated: rows.length >= this.max,
      transfers: rows.map((r) => ({
        chainId, txHash: r.hash.toLowerCase(), logIndex: Number(r.logIndex ?? 0), blockNumber: BigInt(r.blockNumber), kind: 'erc20',
        token: r.contractAddress.toLowerCase(), from: r.from.toLowerCase(), to: r.to.toLowerCase(), value: String(r.value),
        timestamp: new Date(Number(r.timeStamp) * 1000), tokenSymbol: r.tokenSymbol, tokenDecimals: Number(r.tokenDecimal),
        txFrom: null,
      })),
    }
  }
  async getNativeTransactions(chainId, address) {
    const rows = await this.call(chainId, { module: 'account', action: 'txlist', address, page: 1, offset: this.max, sort: 'desc' })
    return {
      truncated: rows.length >= this.max,
      transfers: rows.filter((r) => r.isError !== '1').map((r) => ({
        chainId, txHash: r.hash.toLowerCase(), logIndex: -1, blockNumber: BigInt(r.blockNumber), kind: 'native', token: null,
        from: r.from.toLowerCase(), to: (r.to || '').toLowerCase(), value: String(r.value), timestamp: new Date(Number(r.timeStamp) * 1000), txFrom: r.from.toLowerCase(),
      })),
    }
  }
}
