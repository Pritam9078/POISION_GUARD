import { z } from 'zod'
import { db, tx } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { notFound, badRequest } from '../../shared/errors.js'
import { newId, secretToken } from '../../shared/ids.js'
import { encrypt } from '../../shared/crypto.js'
import { audit } from '../audit/audit.service.js'
import { assertSafeWebhookUrl, deliverOne } from './webhooks.service.js'
import { assertWithinLimit } from '../billing/entitlements.js'

export const WEBHOOK_EVENTS = ['*', 'approval_required', 'intent_approved', 'spend_blocked', 'execution_confirmed', 'execution_problem', 'risk_finding', 'scan_completed', 'test']
const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })

export default async function (app) {
  app.get('/notifications', { preHandler: can('notifications.view') }, async (req, reply) => {
    const uid = req.ctx.user.id
    const unread = req.query.filter === 'unread'
    const rows = await db.q(`SELECT * FROM notifications WHERE workspace_id = $1 AND (user_id IS NULL OR user_id = $2) ${unread ? 'AND NOT ($2 = ANY(read_by))' : ''} ORDER BY created_at DESC LIMIT 200`, [req.ws.id, uid])
    reply.ok({ items: rows.map((n) => ({ id: n.id, at: n.createdAt, channel: n.channel, type: n.type, title: n.title, body: n.body, read: n.readBy.includes(uid), deliveryStatus: n.deliveryStatus, refType: n.refType, refId: n.refId })), unreadCount: rows.filter((n) => !n.readBy.includes(uid)).length })
  })
  app.post('/notifications/:id/read', { preHandler: can('notifications.view') }, async (req, reply) => {
    const r = await db.one(`UPDATE notifications SET read_by = array_append(read_by, $3) WHERE id = $1 AND workspace_id = $2 AND NOT ($3 = ANY(read_by)) RETURNING id`, [req.params.id, req.ws.id, req.ctx.user.id])
    reply.ok({ read: true, changed: !!r })
  })
  app.post('/notifications/read-all', { preHandler: can('notifications.view') }, async (req, reply) => {
    await db.q(`UPDATE notifications SET read_by = array_append(read_by, $2) WHERE workspace_id = $1 AND NOT ($2 = ANY(read_by))`, [req.ws.id, req.ctx.user.id])
    reply.ok({ read: true })
  })

  // ── webhooks: secret shown once, stored encrypted (needed to sign), never returned again ──
  app.get('/webhooks', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    reply.ok({ items: await db.q(`SELECT id, url, events, secret_prefix, status, created_at, rotated_at, (SELECT count(*)::int FROM webhook_deliveries d WHERE d.endpoint_id = e.id AND d.status IN ('failed','dead')) AS failing FROM webhook_endpoints e WHERE workspace_id = $1 ORDER BY created_at DESC`, [req.ws.id]), events: WEBHOOK_EVENTS,
      signature: 'Header PoisonGuard-Signature: t=<unix>,v1=hex(HMAC_SHA256(secret, `${t}.${rawBody}`)). Reject t older than 300s; dedupe on PoisonGuard-Event-Id.' })
  })
  app.post('/webhooks', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    const b = parse(z.object({ url: z.string().url().max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1) }), req.body)
    try { await assertSafeWebhookUrl(b.url) } catch (e) { throw badRequest(e.message) }
    await assertWithinLimit(req.ws.id, 'webhooks')
    const secret = secretToken('whsec_')
    const row = await tx(async (c) => {
      const r = await c.insert('webhook_endpoints', { id: newId('whk'), workspaceId: req.ws.id, url: b.url, events: b.events, secretEnc: encrypt(secret), secretPrefix: secret.slice(0, 10) + '…', createdById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'webhook.create', target: { type: 'webhook', id: r.id }, metadata: { url: b.url, events: b.events } })
      return r
    })
    reply.ok({ id: row.id, url: row.url, events: row.events, status: row.status, secret, secretShownOnce: true }, {}, 201)
  })
  const getW = async (req) => { const w = await db.one('SELECT * FROM webhook_endpoints WHERE id = $1 AND workspace_id = $2', [req.params.webhookId, req.ws.id]); if (!w) throw notFound('Webhook'); return w }
  app.post('/webhooks/:webhookId/rotate-secret', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    const w = await getW(req)
    const secret = secretToken('whsec_')
    await tx(async (c) => { await c.update('webhook_endpoints', { id: w.id }, { secretEnc: encrypt(secret), secretPrefix: secret.slice(0, 10) + '…', rotatedAt: new Date() }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'webhook.rotate_secret', target: { type: 'webhook', id: w.id } }) })
    reply.ok({ id: w.id, secret, secretShownOnce: true })
  })
  app.patch('/webhooks/:webhookId', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    const b = parse(z.object({ events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(), status: z.enum(['active', 'disabled']).optional() }).strict(), req.body)
    const w = await getW(req)
    const r = await tx(async (c) => { const x = await c.update('webhook_endpoints', { id: w.id }, b); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'webhook.update', target: { type: 'webhook', id: w.id }, metadata: b }); return x })
    reply.ok({ id: r.id, url: r.url, events: r.events, status: r.status })
  })
  app.delete('/webhooks/:webhookId', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    const w = await getW(req)
    await tx(async (c) => { await c.update('webhook_endpoints', { id: w.id }, { status: 'disabled' }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'webhook.delete', target: { type: 'webhook', id: w.id } }) })
    reply.ok({ disabled: true })
  })
  app.post('/webhooks/:webhookId/test', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    const w = await getW(req)
    const eventId = newId('evt')
    const d = await db.insert('webhook_deliveries', { id: newId('whd'), endpointId: w.id, eventId, eventType: 'test', payload: { id: eventId, type: 'test', workspaceId: req.ws.id, createdAt: new Date().toISOString(), data: { message: 'PoisonGuard webhook test' } } })
    await deliverOne(d)
    reply.ok(await db.one('SELECT id, status, attempts, last_status_code, last_error, delivered_at FROM webhook_deliveries WHERE id = $1', [d.id]))
  })
  app.get('/webhooks/:webhookId/deliveries', { preHandler: can('webhooks.manage') }, async (req, reply) => {
    await getW(req)
    reply.ok({ items: await db.q('SELECT id, event_id, event_type, status, attempts, last_status_code, last_error, next_attempt_at, delivered_at, created_at FROM webhook_deliveries WHERE endpoint_id = $1 ORDER BY created_at DESC LIMIT 100', [req.params.webhookId]) })
  })
}
