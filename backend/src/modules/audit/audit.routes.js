import { z } from 'zod'
import { db } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { roleCan } from '../../shared/permissions.js'
import { forbidden, notFound, unavailable } from '../../shared/errors.js'
import { pageOf, pageMeta } from '../../shared/http.js'
import { verifyChain, audit } from './audit.service.js'
import { createCheckpoint, anchorProof, verifyProof, proofDto, anchoringConfigured } from '../proofs/proofs.service.js'
import { svc } from '../../services/registry.js'

const viewScope = (req) => {
  if (roleCan(req.ws.membership.role, 'audit.view')) return { sql: '', params: [] }
  if (roleCan(req.ws.membership.role, 'audit.view_own')) return { sql: ' AND actor_id = $2', params: [req.ctx.user.id] }
  throw forbidden()
}
const dto = (e) => ({ id: e.id, seq: e.seq, at: e.createdAt, actor: e.actorLabel, actorType: e.actorType, actorId: e.actorId, action: e.action, target: e.targetId, targetType: e.targetType, outcome: e.outcome, meta: e.metadata, requestId: e.requestId, prevHash: e.prevHash, hash: e.hash, chainHash: `${e.hash.slice(0, 4)}…${e.hash.slice(-4)}` })

export default async function (app) {
  app.get('/audit', async (req, reply) => {
    const scope = viewScope(req)
    const p = pageOf(req)
    const params = [req.ws.id, ...scope.params]; let w = `chain_key = $1${scope.sql}`
    for (const [k, col] of [['action', 'action'], ['actorId', 'actor_id'], ['targetId', 'target_id'], ['targetType', 'target_type'], ['outcome', 'outcome']]) if (req.query[k]) { params.push(req.query[k]); w += ` AND ${col} = $${params.length}` }
    if (req.query.actionPrefix) { params.push(req.query.actionPrefix + '%'); w += ` AND action LIKE $${params.length}` }
    if (req.query.from) { params.push(new Date(req.query.from)); w += ` AND created_at >= $${params.length}` }
    if (req.query.to) { params.push(new Date(req.query.to)); w += ` AND created_at <= $${params.length}` }
    const [rows, total] = await Promise.all([db.q(`SELECT * FROM audit_events WHERE ${w} ORDER BY seq DESC LIMIT ${p.limit} OFFSET ${p.offset}`, params), db.one(`SELECT count(*) FROM audit_events WHERE ${w}`, params)])
    reply.ok({ items: rows.map(dto) }, pageMeta(p, total.count))
  })
  app.get('/audit/:eventId', async (req, reply) => {
    const scope = viewScope(req)
    const e = await db.one(`SELECT * FROM audit_events WHERE id = $${scope.params.length + 2} AND chain_key = $1${scope.sql}`, [req.ws.id, ...scope.params, req.params.eventId])
    if (!e) throw notFound('Audit event')
    reply.ok(dto(e))
  })
  app.post('/audit/verify', { preHandler: can('audit.view') }, async (req, reply) => {
    const b = parse(z.object({ fromSeq: z.number().int().min(1).default(1), toSeq: z.number().int().optional() }), req.body)
    const r = await verifyChain(req.ws.id, b)
    await audit(null, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'audit.verify', outcome: r.verified ? 'success' : 'failure', metadata: { fromSeq: r.fromSeq, toSeq: r.toSeq ?? r.failedAtSeq, verified: r.verified } })
    reply.ok(r)
  })
  app.get('/audit/export', { preHandler: can('audit.view') }, async (req, reply) => {
    const rows = await db.q('SELECT * FROM audit_events WHERE chain_key = $1 ORDER BY seq', [req.ws.id])
    const v = await verifyChain(req.ws.id)
    await audit(null, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'audit.export', metadata: { events: rows.length } })
    if (req.query.format === 'csv') {
      const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
      const csv = ['seq,at,actor_type,actor,action,target_type,target,outcome,prev_hash,hash', ...rows.map((e) => [e.seq, e.createdAt.toISOString(), e.actorType, e.actorLabel, e.action, e.targetType, e.targetId, e.outcome, e.prevHash, e.hash].map(esc).join(','))].join('\n')
      return reply.header('Content-Type', 'text/csv').header('Content-Disposition', `attachment; filename="audit-${req.ws.id}.csv"`).send(csv)
    }
    reply.ok({ exportedAt: new Date().toISOString(), verification: v, events: rows.map(dto) })
  })

  // ── proofs ──
  app.get('/proofs', { preHandler: can('proofs.view') }, async (req, reply) => {
    const rows = await db.q('SELECT * FROM proof_anchors WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200', [req.ws.id])
    const cps = await db.q('SELECT * FROM audit_checkpoints WHERE chain_key = $1 ORDER BY to_seq DESC LIMIT 50', [req.ws.id])
    reply.ok({ items: rows.map(proofDto), checkpoints: cps, anchoringConfigured: anchoringConfigured() })
  })
  app.post('/proofs/checkpoint', { preHandler: can('proofs.manage') }, async (req, reply) => {
    const r = await createCheckpoint(req.ws.id, req.ctx.user.id)
    if (!r) return reply.ok({ created: false, message: 'No new audit events since the last checkpoint.' })
    if (r.failed) return reply.ok({ created: false, verification: r.failed })
    await audit(null, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'proof.checkpoint', target: { type: 'proof', id: r.proof.id } })
    reply.ok({ created: true, checkpoint: r.checkpoint, proof: proofDto(r.proof) }, {}, 201)
  })
  app.get('/proofs/:proofId', { preHandler: can('proofs.view') }, async (req, reply) => {
    const p = await db.one('SELECT * FROM proof_anchors WHERE id = $1 AND workspace_id = $2', [req.params.proofId, req.ws.id])
    if (!p) throw notFound('Proof')
    reply.ok(proofDto(p))
  })
  app.post('/proofs/:proofId/verify', { preHandler: can('proofs.manage') }, async (req, reply) => {
    const p = await db.one('SELECT id FROM proof_anchors WHERE id = $1 AND workspace_id = $2', [req.params.proofId, req.ws.id])
    if (!p) throw notFound('Proof')
    reply.ok(proofDto(await verifyProof(p.id, (id) => svc('chains').adapter(id))))
  })
  app.post('/proofs/:proofId/anchor', { preHandler: can('proofs.manage') }, async (req, reply) => {
    const p = await db.one('SELECT id FROM proof_anchors WHERE id = $1 AND workspace_id = $2', [req.params.proofId, req.ws.id])
    if (!p) throw notFound('Proof')
    try { reply.ok(proofDto(await anchorProof(p.id))) } catch (e) { if (e.code === 'ANCHOR_NOT_CONFIGURED') throw unavailable(e.message, e.code); throw e }
  })
}
