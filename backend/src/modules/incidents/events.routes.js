import { z } from 'zod'
import { db, tx } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { notFound, badRequest } from '../../shared/errors.js'
import { assertTransition } from '../../shared/states.js'
import { audit } from '../audit/audit.service.js'

/** Workspace security events (incidents with workspace scope). The originating event is immutable; only status/notes change. */
export default async function (app) {
  const getE = async (req) => {
    const e = await db.one(`SELECT * FROM security_incidents WHERE id = $1 AND workspace_id = $2`, [req.params.eventId, req.ws.id])
    if (!e) throw notFound('Security event')
    return e
  }
  const dto = async (e, full) => ({ id: e.id, at: e.openedAt, severity: e.severity, type: e.category, category: e.category, title: e.title, detail: e.description, status: e.status, sourceRef: e.sourceRef, evidence: e.evidence, assigneeUserId: e.assigneeUserId, resolution: e.resolution, resolvedAt: e.resolvedAt, kind: e.type,
    ...(full ? { notes: await db.q('SELECT n.id, n.body, n.created_at, u.name AS author FROM incident_notes n LEFT JOIN users u ON u.id = n.author_user_id WHERE incident_id = $1 ORDER BY n.created_at', [e.id]) } : {}) })

  app.get('/security-events', { preHandler: can('events.view') }, async (req, reply) => {
    const params = [req.ws.id]; let w = 'workspace_id = $1'
    for (const k of ['status', 'severity', 'category']) if (req.query[k]) { params.push(req.query[k]); w += ` AND ${k} = $${params.length}` }
    const rows = await db.q(`SELECT * FROM security_incidents WHERE ${w} ORDER BY opened_at DESC LIMIT 200`, params)
    reply.ok({ items: await Promise.all(rows.map((e) => dto(e))) })
  })
  app.get('/security-events/:eventId', { preHandler: can('events.view') }, async (req, reply) => reply.ok(await dto(await getE(req), true)))

  const transition = (to, needReason) => async (req, reply) => {
    const b = parse(z.object({ note: z.string().trim().max(2000).optional(), assigneeUserId: z.string().optional() }), req.body)
    if (needReason && !b.note) throw badRequest('A resolution note is required')
    const e = await getE(req)
    if (to === 'assign') {
      const m = await db.one(`SELECT id FROM memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`, [req.ws.id, b.assigneeUserId])
      if (!m) throw badRequest('Assignee must be an active member')
    } else assertTransition('incident', e.status, to)
    const row = await tx(async (c) => {
      const patch = to === 'assign' ? { assigneeUserId: b.assigneeUserId, status: e.status === 'open' ? 'investigating' : undefined } : { status: to, resolution: to === 'resolved' ? b.note : undefined, resolvedAt: to === 'resolved' ? new Date() : undefined }
      const r = await c.update('security_incidents', { id: e.id }, patch)
      if (b.note) await c.insert('incident_notes', { id: (await import('../../shared/ids.js')).newId('inn'), incidentId: e.id, authorUserId: req.ctx.user.id, body: b.note })
      await audit(c, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: `security_event.${to}`, target: { type: 'incident', id: e.id }, metadata: { from: e.status } })
      return r
    })
    reply.ok(await dto(row, true))
  }
  app.post('/security-events/:eventId/acknowledge', { preHandler: can('events.manage') }, transition('acknowledged'))
  app.post('/security-events/:eventId/investigate', { preHandler: can('events.manage') }, transition('investigating'))
  app.post('/security-events/:eventId/escalate', { preHandler: can('events.manage') }, transition('escalated'))
  app.post('/security-events/:eventId/resolve', { preHandler: can('events.manage') }, transition('resolved', true))
  app.post('/security-events/:eventId/assign', { preHandler: can('events.manage') }, transition('assign'))
  app.post('/security-events/:eventId/notes', { preHandler: can('events.manage') }, async (req, reply) => {
    const b = parse(z.object({ body: z.string().trim().min(1).max(4000) }), req.body)
    const e = await getE(req)
    await tx(async (c) => {
      await c.insert('incident_notes', { id: (await import('../../shared/ids.js')).newId('inn'), incidentId: e.id, authorUserId: req.ctx.user.id, body: b.body })
      await audit(c, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'security_event.note', target: { type: 'incident', id: e.id } })
    })
    reply.ok(await dto(e, true), {}, 201)
  })
}
