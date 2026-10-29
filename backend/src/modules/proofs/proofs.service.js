import { Wallet, Interface, JsonRpcProvider, Contract, keccak256, toUtf8Bytes } from 'ethers'
import { db, tx } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { sha256 } from '../../shared/crypto.js'
import { env } from '../../config/env.js'
import { chainById } from '../../shared/chains.js'
import { verifyChain, audit } from '../audit/audit.service.js'

// ProofRegistry v2 (contracts/src/ProofRegistry.sol). Kind: 1=AuditCheckpoint 2=Methodology 3=Evaluation 4=Execution 5=Report
export const REGISTRY_ABI = new Interface([
  'function anchor(bytes32 batchId, bytes32 scope, bytes32 commitment, uint8 kind, bytes32 expectedPrevBatchId) returns (uint64)',
  'function headOf(bytes32 scope) view returns (bytes32)',
  'function verify(bytes32 batchId, bytes32 commitment) view returns (bool exists, bool matches, bool revoked, uint64 timestamp)',
  'event Anchored(bytes32 indexed batchId, bytes32 indexed scope, bytes32 commitment, uint8 kind, uint64 seq, bytes32 prevBatchId, address indexed submitter, uint64 timestamp)',
  'event AnchorRevoked(bytes32 indexed batchId, bytes32 indexed scope, bytes32 reasonHash, address indexed revoker)',
])
const KIND = { audit_checkpoint: 1, methodology: 2, evaluation: 3, execution: 4, report: 5 }
/** Opaque on-chain scope: never a name or email. Matches contracts/client scopeOf(). */
export const scopeOf = (key) => keccak256(toUtf8Bytes(`poisonguard:scope:${key}`))
export const anchoringConfigured = () => !!(env.PROOF_REGISTRY_ADDRESS && env.PROOF_REGISTRY_CHAIN_ID && env.PROOF_ANCHOR_PRIVATE_KEY && env[chainById(env.PROOF_REGISTRY_CHAIN_ID)?.rpcEnvVar])

/** Verify the chain up to its head, then record a checkpoint and a LOCAL proof (not on-chain until anchored). */
export async function createCheckpoint(chainKey, createdBy = 'system') {
  const last = await db.one('SELECT to_seq FROM audit_checkpoints WHERE chain_key = $1 ORDER BY to_seq DESC LIMIT 1', [chainKey])
  const head = await db.one('SELECT max(seq) AS s FROM audit_events WHERE chain_key = $1', [chainKey])
  if (!head?.s || head.s <= (last?.toSeq ?? 0)) return null
  const v = await verifyChain(chainKey)
  if (!v.verified) {
    const { openIncident } = await import('../incidents/incidents.service.js')
    await tx((c) => openIncident(c, { workspaceId: chainKey === 'platform' ? null : chainKey, type: 'security', category: 'audit_integrity_failure', severity: 'critical', title: 'Audit hash-chain verification failed', description: `${v.reason} at seq ${v.failedAtSeq}`, sourceRef: `${chainKey}:${v.failedAtSeq}`, dedupeHours: 24 }))
    return { failed: v }
  }
  return tx(async (c) => {
    const cp = await c.insert('audit_checkpoints', { id: newId('chk'), chainKey, fromSeq: (last?.toSeq ?? 0) + 1, toSeq: v.toSeq, headHash: v.headHash, eventCount: v.toSeq - (last?.toSeq ?? 0), createdBy })
    const batchId = '0x' + sha256(`${chainKey}:${cp.toSeq}:${cp.headHash}`)
    const pa = await c.insert('proof_anchors', { id: newId('prf'), workspaceId: chainKey === 'platform' ? null : chainKey, checkpointId: cp.id, kind: 'audit_checkpoint', batchId, commitment: '0x' + cp.headHash, status: 'local',
      verification: `Application hash chain recomputed for seq 1–${v.toSeq}; head ${cp.headHash.slice(0, 16)}…. Not anchored on-chain.` })
    return { checkpoint: cp, proof: pa }
  })
}

export async function checkpointAll() {
  const keys = await db.q(`SELECT DISTINCT chain_key FROM audit_events`)
  const out = []
  for (const { chainKey } of keys) out.push(await createCheckpoint(chainKey).catch((e) => ({ error: e.message })))
  return { checkpoints: out.filter(Boolean).length }
}

/** Submit a commitment with the PLATFORM anchoring key (never a customer key). */
export async function anchorProof(proofId) {
  if (!anchoringConfigured()) { const e = new Error('On-chain anchoring is not configured (PROOF_REGISTRY_* env)'); e.code = 'ANCHOR_NOT_CONFIGURED'; throw e }
  const p = await db.one('SELECT * FROM proof_anchors WHERE id = $1', [proofId])
  if (!p || p.status !== 'local') return p
  const chain = chainById(env.PROOF_REGISTRY_CHAIN_ID)
  const wallet = new Wallet(env.PROOF_ANCHOR_PRIVATE_KEY, new JsonRpcProvider(env[chain.rpcEnvVar], chain.id, { staticNetwork: true }))
  const scope = scopeOf(p.workspaceId || 'platform')
  const reg = new Contract(env.PROOF_REGISTRY_ADDRESS, REGISTRY_ABI, wallet)
  const head = await reg.headOf(scope) // optimistic ordering: the contract rejects if another anchor landed first
  const sent = await reg.anchor(p.batchId, scope, p.commitment, KIND[p.kind] ?? 5, head)
  return db.update('proof_anchors', { id: p.id }, { status: 'submitted', chainId: chain.id, contractAddress: env.PROOF_REGISTRY_ADDRESS.toLowerCase(), txHash: sent.hash.toLowerCase(), verification: 'Anchor transaction submitted; awaiting receipt verification.' })
}

/** An anchor is "anchored" only when the receipt succeeded AND the expected Anchored event with the same commitment is present. */
export async function verifyProof(proofId, adapterFor) {
  const p = await db.one('SELECT * FROM proof_anchors WHERE id = $1', [proofId])
  if (!p) return null
  const local = p.checkpointId ? await db.one('SELECT * FROM audit_checkpoints WHERE id = $1', [p.checkpointId]) : null
  if (local) {
    const v = await verifyChain(local.chainKey, { fromSeq: 1, toSeq: local.toSeq })
    if (!v.verified || v.headHash !== local.headHash) return db.update('proof_anchors', { id: p.id }, { status: 'mismatch', verification: `Local verification failed: ${v.reason || 'head hash differs from checkpoint'}`, verifiedAt: new Date() })
  }
  if (!p.txHash) return db.update('proof_anchors', { id: p.id }, { verification: `Application hash chain re-verified for seq 1–${local?.toSeq}. Not anchored on-chain.`, verifiedAt: new Date() })
  const a = adapterFor(p.chainId)
  if (!a) return { ...p, verification: 'RPC not configured for anchor chain; on-chain verification unavailable' }
  const r = await a.getTransactionReceipt(p.txHash)
  if (!r) return db.update('proof_anchors', { id: p.id }, { verification: 'Anchor transaction not yet mined', verifiedAt: new Date() })
  if (r.status !== 1) return db.update('proof_anchors', { id: p.id }, { status: 'failed', verification: 'Anchor transaction reverted', verifiedAt: new Date() })
  const ev = (r.logs || []).filter((l) => l.address?.toLowerCase() === p.contractAddress).map((l) => { try { return REGISTRY_ABI.parseLog(l) } catch { return null } }).find((e) => e?.name === 'Anchored' && e.args.batchId === p.batchId)
  if (!ev || ev.args.commitment.toLowerCase() !== p.commitment.toLowerCase() || ev.args.scope !== scopeOf(p.workspaceId || 'platform')) return db.update('proof_anchors', { id: p.id }, { status: 'mismatch', verification: 'Receipt lacks the expected Anchored event for this batch/scope/commitment', verifiedAt: new Date() })
  // Current on-chain state (catches later revocation by the registry's REVOKER_ROLE).
  const state = REGISTRY_ABI.decodeFunctionResult('verify', await a.provider.call({ to: p.contractAddress, data: REGISTRY_ABI.encodeFunctionData('verify', [p.batchId, p.commitment]) }))
  if (state.revoked) return db.update('proof_anchors', { id: p.id }, { status: 'failed', verification: 'Anchor was REVOKED on-chain by the registry revoker; do not rely on it.', verifiedAt: new Date() })
  return db.update('proof_anchors', { id: p.id }, { status: 'anchored', blockNumber: r.blockNumber, verification: `Anchored event verified in block ${r.blockNumber} (scope seq ${ev.args.seq}); commitment matches the local checkpoint; not revoked.`, verifiedAt: new Date() })
}

export function proofDto(p) {
  return { id: p.id, kind: p.kind, scope: p.workspaceId ? 'Workspace audit chain' : 'Platform audit chain', batchId: p.batchId, commitment: p.commitment, status: p.status,
    anchor: p.txHash ? `${chainById(p.chainId)?.name} tx ${p.txHash}` : 'Internal only (not on-chain)', chainId: p.chainId, contractAddress: p.contractAddress, txHash: p.txHash, blockNumber: p.blockNumber,
    verification: p.verification, verifiedAt: p.verifiedAt, at: p.createdAt, isOnChain: p.status === 'anchored' }
}
