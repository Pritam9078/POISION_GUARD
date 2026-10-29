import { db, tx, J } from '../../db/index.js'
import { sha256, canonicalJson } from '../../shared/crypto.js'
import { newId } from '../../shared/ids.js'

export const GENESIS = '0'.repeat(64)

function eventHash(prevHash, e) {
  return sha256(prevHash + canonicalJson({
    chainKey: e.chainKey, seq: e.seq, workspaceId: e.workspaceId ?? null, actorType: e.actorType, actorId: e.actorId ?? null,
    actorLabel: e.actorLabel, action: e.action, targetType: e.targetType ?? null, targetId: e.targetId ?? null,
    outcome: e.outcome, metadata: e.metadata ?? {}, createdAt: new Date(e.createdAt).toISOString(),
  }))
}

/**
 * Append an event to the workspace's (or the platform's) hash chain.
 * Pass `c` to make the audit write part of the caller's transaction (it must commit together).
 */
export async function audit(c, { workspaceId = null, actor, action, target = {}, outcome = 'success', metadata = {}, requestId = null }) {
  const run = async (t) => {
    const chainKey = workspaceId || 'platform'
    await t.q('SELECT pg_advisory_xact_lock(hashtext($1))', [chainKey])
    const last = await t.one('SELECT seq, hash FROM audit_events WHERE chain_key = $1 ORDER BY seq DESC LIMIT 1', [chainKey])
    const e = {
      id: newId('aud'), chainKey, seq: (last?.seq ?? 0) + 1, workspaceId, actorType: actor?.type || 'system', actorId: actor?.id ?? null,
      actorLabel: actor?.label || actor?.type || 'system', action, targetType: target.type ?? null, targetId: target.id ?? null,
      outcome, metadata, requestId, prevHash: last?.hash ?? GENESIS, createdAt: new Date(Math.floor(Date.now())),
    }
    e.hash = eventHash(e.prevHash, e)
    await t.insert('audit_events', { ...e, metadata: J(metadata) })
    return e
  }
  return c ? run(c) : tx(run)
}

/** Recompute the chain between seqs. Reports exactly what range was verified and the first failure. */
export async function verifyChain(chainKey, { fromSeq = 1, toSeq = null } = {}) {
  const rows = await db.q(
    `SELECT * FROM audit_events WHERE chain_key = $1 AND seq >= $2 ${toSeq ? 'AND seq <= $3' : ''} ORDER BY seq ASC`,
    toSeq ? [chainKey, fromSeq, toSeq] : [chainKey, fromSeq])
  let prev = GENESIS
  if (fromSeq > 1) prev = (await db.one('SELECT hash FROM audit_events WHERE chain_key = $1 AND seq = $2', [chainKey, fromSeq - 1]))?.hash ?? null
  let expectedSeq = fromSeq
  for (const r of rows) {
    if (r.seq !== expectedSeq) return fail(r.seq, `Missing link: expected seq ${expectedSeq}, found ${r.seq}`)
    if (prev !== null && r.prevHash !== prev) return fail(r.seq, 'prev_hash does not match previous event hash')
    const h = eventHash(r.prevHash, r)
    if (h !== r.hash) return fail(r.seq, 'Event content does not match its stored hash')
    prev = r.hash; expectedSeq++
  }
  return {
    chainKey, verified: true, kind: 'application_hash_chain', fromSeq, toSeq: rows.at(-1)?.seq ?? fromSeq - 1,
    eventsChecked: rows.length, headHash: rows.at(-1)?.hash ?? prev, verifiedAt: new Date().toISOString(),
    statement: `Recomputed ${rows.length} chained SHA-256 hashes (seq ${fromSeq}–${rows.at(-1)?.seq ?? fromSeq - 1}). This verifies application-level integrity only; it is not an on-chain anchor.`,
  }
  function fail(seq, reason) {
    return { chainKey, verified: false, kind: 'application_hash_chain', fromSeq, failedAtSeq: seq, reason, eventsChecked: seq - fromSeq, verifiedAt: new Date().toISOString() }
  }
}

export const actorFromReq = (req) => {
  if (req.ctx?.agent) return { type: 'agent', id: req.ctx.agent.id, label: `agent:${req.ctx.agent.name}` }
  if (req.ctx?.staff) return { type: 'staff', id: req.ctx.staff.id, label: `staff:${req.ctx.staff.email}` }
  if (req.ctx?.user) return { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }
  return { type: 'anonymous', id: null, label: 'anonymous' }
}
