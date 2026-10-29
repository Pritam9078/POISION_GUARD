import { z } from 'zod'
import { db } from '../../db/index.js'
import { parse, zAddress, zBaseUnits, zTxHash } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { notFound } from '../../shared/errors.js'
import { resolveChain } from '../../shared/chains.js'
import { roleCan } from '../../shared/permissions.js'
import { createIntent, evaluateIntent, decide, updateParams, cancelIntent, prepareIntent, submitIntent, intentDto } from './intents.service.js'
import { reconcileAttempt } from './execution.service.js'
import { assertWithinLimit } from '../billing/entitlements.js'
import { pageOf, pageMeta } from '../../shared/http.js'

const userActor = (req) => ({ type: 'user', userId: req.ctx.user.id, label: req.ctx.user.name })
const zChainId = z.union([z.number(), z.string()]).transform((v) => resolveChain(v)?.id).pipe(z.number({ error: 'Unsupported network' }))

const TABS = {
  pending_all: `status = 'pending_approval'`, approved: `status = 'approved'`, rejected: `status = 'denied'`, expired: `status = 'expired'`, cancelled: `status = 'cancelled'`,
  awaiting_signature: `status = 'ready_to_sign'`, awaiting_confirmation: `status = 'submitted'`, reconciliation_failures: `status IN ('reconciliation_mismatch','reverted','failed')`,
}

export default async function (app) {
  const getI = async (req) => {
    const i = await db.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2', [req.params.intentId, req.ws.id])
    if (!i) throw notFound('Spend intent')
    return i
  }

  app.get('/spend-intents', { preHandler: can('intents.view') }, async (req, reply) => {
    const p = pageOf(req)
    const params = [req.ws.id]; let w = 'workspace_id = $1'
    if (req.query.status) { params.push(req.query.status); w += ` AND status = $${params.length}` }
    if (req.query.agentId) { params.push(req.query.agentId); w += ` AND agent_id = $${params.length}` }
    if (req.query.walletId) { params.push(req.query.walletId); w += ` AND wallet_id = $${params.length}` }
    const [rows, total] = await Promise.all([db.q(`SELECT * FROM spend_intents WHERE ${w} ORDER BY created_at DESC LIMIT ${p.limit} OFFSET ${p.offset}`, params), db.one(`SELECT count(*) FROM spend_intents WHERE ${w}`, params)])
    reply.ok({ items: await Promise.all(rows.map(intentDto)) }, pageMeta(p, total.count))
  })

  app.post('/spend-intents', { preHandler: can('intents.create') }, async (req, reply) => {
    const b = parse(z.object({ walletId: z.string(), chainId: zChainId, toAddress: zAddress, assetType: z.enum(['native', 'erc20']), tokenAddress: zAddress.optional(), amount: zBaseUnits, purpose: z.string().trim().min(3).max(500), reference: z.string().max(120).optional(), evidence: z.string().max(1000).optional(), expiresAt: z.string().datetime().optional(), idempotencyKey: z.string().min(8).max(80).optional(), evaluate: z.boolean().default(false) }), req.body)
    await assertWithinLimit(req.ws.id, 'monthlySpendIntents')
    const { intent, replayed } = await createIntent(req.ws.id, userActor(req), { ...b, idempotencyKey: req.headers['idempotency-key'] || b.idempotencyKey })
    if (b.evaluate && !replayed) { const ev = await evaluateIntent(req.ws.id, intent.id, userActor(req)); return reply.ok({ ...(await intentDto(ev.intent)), evaluation: ev.evaluation }, {}, 201) }
    reply.ok({ ...(await intentDto(intent)), replayed }, {}, replayed ? 200 : 201)
  })

  app.get('/spend-intents/:intentId', { preHandler: can('intents.view') }, async (req, reply) => reply.ok(await intentDto(await getI(req))))
  app.get('/spend-intents/:intentId/evaluations', { preHandler: can('intents.view') }, async (req, reply) => {
    await getI(req)
    reply.ok({ items: await db.q('SELECT id, decision, reason_codes, required_approvals, policy_version_ids, params_hash, results, created_at FROM policy_evaluations WHERE intent_id = $1 ORDER BY created_at DESC', [req.params.intentId]) })
  })

  app.patch('/spend-intents/:intentId', { preHandler: can('intents.create') }, async (req, reply) => {
    const b = parse(z.object({ toAddress: zAddress.optional(), amount: zBaseUnits.optional(), assetType: z.enum(['native', 'erc20']).optional(), tokenAddress: zAddress.nullable().optional(), purpose: z.string().trim().min(3).max(500).optional(), reference: z.string().max(120).optional() }).strict(), req.body)
    const out = await updateParams(req.ws, req.params.intentId, userActor(req), b)
    reply.ok({ ...(await intentDto(out.intent)), approvalsInvalidated: out.approvalsInvalidated })
  })
  app.post('/spend-intents/:intentId/evaluate', { preHandler: can('intents.create') }, async (req, reply) => {
    const ev = await evaluateIntent(req.ws.id, req.params.intentId, userActor(req))
    reply.ok({ ...(await intentDto(ev.intent)), evaluation: ev.evaluation })
  })
  app.post('/spend-intents/:intentId/approve', { preHandler: can('intents.approve') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().max(1000).default('') }), req.body)
    reply.ok(await intentDto(await decide(req.ws, req.params.intentId, req.ctx.user, { decision: 'approved', reason: b.reason })))
  })
  app.post('/spend-intents/:intentId/reject', { preHandler: can('intents.approve') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().trim().min(3, 'A rejection reason is required').max(1000) }), req.body)
    reply.ok(await intentDto(await decide(req.ws, req.params.intentId, req.ctx.user, { decision: 'rejected', reason: b.reason })))
  })
  app.post('/spend-intents/:intentId/deny', { preHandler: can('intents.approve') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().trim().min(3).max(1000) }), req.body)
    reply.ok(await intentDto(await decide(req.ws, req.params.intentId, req.ctx.user, { decision: 'rejected', reason: b.reason })))
  })
  app.post('/spend-intents/:intentId/cancel', { preHandler: can('intents.view') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().max(500).default('') }), req.body)
    reply.ok(await intentDto(await cancelIntent(req.ws, req.params.intentId, userActor(req), b.reason)))
  })
  app.post('/spend-intents/:intentId/prepare', { preHandler: can('intents.execute') }, async (req, reply) => {
    const out = await prepareIntent(req.ws, req.params.intentId, userActor(req))
    reply.ok({ ...(await intentDto(out.intent)), unsignedTransaction: out.unsignedTransaction, note: out.note })
  })
  app.post('/spend-intents/:intentId/submit', { preHandler: can('intents.execute') }, async (req, reply) => {
    const b = parse(z.object({ txHash: zTxHash }), req.body)
    const out = await submitIntent(req.ws, req.params.intentId, userActor(req), b.txHash)
    reply.ok({ ...(await intentDto(out.intent)), note: 'Recorded. The intent becomes "confirmed" only after the receipt is verified against the approved parameters.' }, {}, 202)
  })
  app.post('/spend-intents/:intentId/reconcile', { preHandler: can('intents.execute') }, async (req, reply) => {
    const i = await getI(req)
    const att = await db.one(`SELECT id FROM execution_attempts WHERE intent_id = $1 AND status = 'submitted' ORDER BY created_at DESC LIMIT 1`, [i.id])
    if (!att) throw notFound('Pending execution attempt')
    const r = await reconcileAttempt({ attemptId: att.id })
    reply.ok({ ...(await intentDto(await getI(req))), reconcile: r })
  })

  // Approval queue
  app.get('/approvals', { preHandler: can('intents.view') }, async (req, reply) => {
    const tab = req.query.tab || 'pending_mine'
    let rows
    if (tab === 'pending_mine') {
      rows = roleCan(req.ws.membership.role, 'intents.approve') ? await db.q(`SELECT i.* FROM spend_intents i WHERE i.workspace_id = $1 AND i.status = 'pending_approval'
        AND (i.requested_by_user_id IS NULL OR i.requested_by_user_id <> $2)
        AND NOT EXISTS (SELECT 1 FROM approvals a WHERE a.intent_id = i.id AND a.approver_user_id = $2 AND a.params_hash = i.params_hash)
        AND NOT EXISTS (SELECT 1 FROM agents g WHERE g.id = i.agent_id AND g.owner_user_id = $2)
        ORDER BY i.created_at`, [req.ws.id, req.ctx.user.id]) : []
    } else {
      if (!TABS[tab]) throw notFound('Approval tab')
      rows = await db.q(`SELECT * FROM spend_intents WHERE workspace_id = $1 AND ${TABS[tab]} ORDER BY updated_at DESC LIMIT 200`, [req.ws.id])
    }
    const counts = await db.one(`SELECT count(*) FILTER (WHERE status = 'pending_approval')::int AS pending_all, count(*) FILTER (WHERE status = 'ready_to_sign')::int AS awaiting_signature, count(*) FILTER (WHERE status = 'submitted')::int AS awaiting_confirmation, count(*) FILTER (WHERE status IN ('reconciliation_mismatch','reverted','failed'))::int AS reconciliation_failures FROM spend_intents WHERE workspace_id = $1`, [req.ws.id])
    reply.ok({ tab, counts, items: await Promise.all(rows.map(intentDto)), tabs: ['pending_mine', ...Object.keys(TABS)] })
  })
}
