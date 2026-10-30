/**
 * Dependency-light client for ProofRegistry v2 (ethers v6). Use it in the backend, a frontend "verify" page,
 * or an auditor's script. Read functions need only an RPC; write functions need a signer with the right role.
 */
const { Contract, id, ZeroHash } = require('ethers')
const { abi } = require('../abi/ProofRegistry.json')

const Kind = Object.freeze({ AuditCheckpoint: 1, Methodology: 2, Evaluation: 3, Execution: 4, Report: 5 })
const KindName = ['None', 'AuditCheckpoint', 'Methodology', 'Evaluation', 'Execution', 'Report']
/** Opaque scope ids — never put names or emails on chain. */
const scopeOf = (key) => id(`poisonguard:scope:${key}`)

class ProofRegistryClient {
  constructor(address, runner) { this.contract = new Contract(address, abi, runner) }

  // ── public verification ──
  async verify(batchId, commitment) {
    const [exists, matches, revoked, timestamp] = await this.contract.verify(batchId, commitment)
    return { exists, matches, revoked, valid: exists && matches && !revoked, anchoredAt: exists ? new Date(Number(timestamp) * 1000).toISOString() : null }
  }
  async getAnchor(batchId) {
    if (!(await this.contract.isAnchored(batchId))) return null
    const a = await this.contract.getAnchor(batchId)
    return { batchId, scope: a.scope, commitment: a.commitment, prevBatchId: a.prevBatchId, seq: Number(a.seq), timestamp: Number(a.timestamp), blockNumber: Number(a.blockNumber), kind: KindName[Number(a.kind)], submitter: a.submitter, revoked: a.revoked,
      revocationReasonHash: a.revoked ? await this.contract.revocationReasonOf(batchId) : null }
  }
  /** Walks a scope's chain from head backwards, checking seq and prev links. Returns the list and any break. */
  async walkScope(scope, { max = 1000 } = {}) {
    const out = []; let cur = await this.contract.headOf(scope)
    while (cur !== ZeroHash && out.length < max) { const a = await this.getAnchor(cur); if (!a) return { anchors: out, broken: `missing ${cur}` }; out.push(a); cur = a.prevBatchId }
    const count = Number(await this.contract.countOf(scope))
    for (let i = 0; i < out.length; i++) if (out[i].seq !== count - i) return { anchors: out, broken: `seq mismatch at ${out[i].batchId}` }
    return { anchors: out.reverse(), broken: null, complete: out.length === count }
  }

  // ── writes (ANCHORER_ROLE) ──
  async anchor({ batchId, scope, commitment, kind, expectedPrevBatchId }) {
    const prev = expectedPrevBatchId ?? (await this.contract.headOf(scope))
    const tx = await this.contract.anchor(batchId, scope, commitment, kind, prev)
    return { txHash: tx.hash, wait: () => tx.wait() }
  }
  /** Parse and check the Anchored event in a receipt — use this before declaring something "anchored". */
  confirmFromReceipt(receipt, { batchId, commitment }) {
    if (!receipt || receipt.status !== 1) return { ok: false, reason: 'receipt missing or reverted' }
    const target = this.contract.target.toLowerCase()
    for (const log of receipt.logs || []) {
      if (log.address?.toLowerCase() !== target) continue
      let ev; try { ev = this.contract.interface.parseLog(log) } catch { continue }
      if (ev?.name === 'Anchored' && ev.args.batchId === batchId) {
        return ev.args.commitment.toLowerCase() === commitment.toLowerCase() ? { ok: true, seq: Number(ev.args.seq), blockNumber: receipt.blockNumber } : { ok: false, reason: 'commitment mismatch in event' }
      }
    }
    return { ok: false, reason: 'Anchored event for this batch not found' }
  }
}

module.exports = { ProofRegistryClient, Kind, KindName, scopeOf }
