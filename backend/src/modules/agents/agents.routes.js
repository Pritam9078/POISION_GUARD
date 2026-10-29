import { z } from 'zod'
import { db, tx, J } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { newId, secretToken } from '../../shared/ids.js'
import { hashToken } from '../../shared/crypto.js'
import { notFound, conflict, badRequest, forbidden } from '../../shared/errors.js'
import { chainById } from '../../shared/chains.js'
import { audit } from '../audit/audit.service.js'
import { assertWithinLimit } from '../billing/entitlements.js'
import { openIncident } from '../incidents/incidents.service.js'
import { roleCan } from '../../shared/permissions.js'

export const AGENT_TOOLS = ['check_recipient', 'scan_wallet', 'propose_transfer', 'propose_revoke']
const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })
const limit = z.object({ asset: z.union([z.literal('native'), z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((v) => v.toLowerCase())]), chainId: z.number().int(), amount: z.string().regex(/^\d{1,78}$/) })
const agentBody = z.object({
  name: z.string().trim().regex(/^[a-z0-9][a-z0-9-_.]{1,62}$/i, 'Use 2–63 letters, digits, dashes'), description: z.string().trim().min(5).max(500),
  ownerUserId: z.string().optional(), environment: z.enum(['production', 'staging', 'development']).default('production'),
  allowedChains: z.array(z.number().int()).min(1), controlledWalletIds: z.array(z.string()).default([]), tools: z.array(z.enum(AGENT_TOOLS)).min(1),
  perTxLimits: z.array(limit).default([]), periodLimits: z.array(limit).default([]), periodHours: z.number().int().min(1).max(744).default(24),
  approvalThreshold: z.array(limit).default([]), expiresAt: z.string().datetime(),
})

export async function agentDto(a, { full = false } = {}) {
  const [tools, owner, ws] = await Promise.all([db.q('SELECT tool FROM agent_tool_permissions WHERE agent_id = $1 ORDER BY tool', [a.id]), db.one('SELECT name FROM users WHERE id = $1', [a.ownerUserId]), db.one('SELECT name FROM workspaces WHERE id = $1', [a.workspaceId])])
  const base = { id: a.id, name: a.name, description: a.description, owner: owner?.name, ownerUserId: a.ownerUserId, environment: a.environment, workspace: ws?.name,
    networks: a.allowedChains.map((c) => chainById(c)?.key ?? String(c)), allowedChains: a.allowedChains, controlledWalletIds: a.controlledWalletIds,
    permittedActions: tools.map((t) => t.tool), status: a.status, frozenAt: a.frozenAt, frozenReason: a.frozenReason,
    limits: { perTx: a.perTxLimits, period: a.periodLimits, periodHours: a.periodHours, approvalThreshold: a.approvalThreshold, unit: 'base units (no USD conversion — PoisonGuard has no price oracle)' },
    expiresAt: a.expiresAt, createdAt: a.createdAt, updatedAt: a.updatedAt }
  if (!full) return base
  const [creds, activity, blocked] = await Promise.all([
    db.q('SELECT id, label, prefix, status, created_at, last_used_at, revoked_at, expires_at FROM agent_credentials WHERE agent_id = $1 ORDER BY created_at DESC', [a.id]),
    db.q('SELECT created_at AS at, tool AS action, outcome, reason, intent_id, detail FROM agent_requests WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 50', [a.id]),
    db.q(`SELECT id, created_at AS at, reason, intent_id AS intent, tool, detail FROM agent_requests WHERE agent_id = $1 AND outcome = 'blocked' ORDER BY created_at DESC LIMIT 50`, [a.id]),
  ])
  return { ...base, credentials: creds, activity, blockedRequests: blocked }
}

export default async function (app) {
  const getA = async (req, lock) => {
    const a = await db.one(`SELECT * FROM agents WHERE id = $1 AND workspace_id = $2`, [req.params.agentId, req.ws.id])
    if (!a) throw notFound('Agent')
    return a
  }
  const validateRefs = async (req, b) => {
    for (const c of b.allowedChains) if (!chainById(c)) throw badRequest(`Unsupported chain ${c}`)
    if (b.controlledWalletIds?.length) {
      const ws = await db.q(`SELECT id, chain_id FROM watched_wallets WHERE workspace_id = $1 AND id = ANY($2) AND status <> 'removed'`, [req.ws.id, b.controlledWalletIds])
      if (ws.length !== new Set(b.controlledWalletIds).size) throw badRequest('Every controlled wallet must be a watched wallet in this workspace')
    }
    if (b.ownerUserId) { const m = await db.one(`SELECT id FROM memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`, [req.ws.id, b.ownerUserId]); if (!m) throw badRequest('Owner must be an active member') }
  }

  app.get('/agents', { preHandler: can('agents.view') }, async (req, reply) => {
    const rows = await db.q(`SELECT * FROM agents WHERE workspace_id = $1 ${req.query.status ? 'AND status = $2' : ''} ORDER BY created_at DESC`, req.query.status ? [req.ws.id, req.query.status] : [req.ws.id])
    reply.ok({ items: await Promise.all(rows.map((a) => agentDto(a))) })
  })

  app.post('/agents', { preHandler: can('agents.manage') }, async (req, reply) => {
    const b = parse(agentBody, req.body)
    if (new Date(b.expiresAt) <= new Date()) throw badRequest('expiresAt must be in the future')
    if (b.tools.includes('propose_transfer') && !b.perTxLimits.length) throw badRequest('Agents with propose_transfer need at least one explicit per-transaction limit')
    await validateRefs(req, b)
    await assertWithinLimit(req.ws.id, 'agents')
    const a = await tx(async (c) => {
      if (await c.one('SELECT id FROM agents WHERE workspace_id = $1 AND name = $2', [req.ws.id, b.name])) throw conflict('An agent with this name already exists')
      const row = await c.insert('agents', { id: newId('agt'), workspaceId: req.ws.id, name: b.name, description: b.description, ownerUserId: b.ownerUserId || req.ctx.user.id, environment: b.environment,
        allowedChains: b.allowedChains, controlledWalletIds: b.controlledWalletIds, perTxLimits: J(b.perTxLimits), periodLimits: J(b.periodLimits), periodHours: b.periodHours, approvalThreshold: J(b.approvalThreshold),
        status: 'pending', expiresAt: new Date(b.expiresAt), createdById: req.ctx.user.id })
      for (const t of b.tools) await c.insert('agent_tool_permissions', { id: newId('atp'), agentId: row.id, tool: t })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.register', target: { type: 'agent', id: row.id }, metadata: { tools: b.tools, chains: b.allowedChains } })
      return row
    })
    reply.ok(await agentDto(a, { full: true }), {}, 201)
  })

  app.get('/agents/:agentId', { preHandler: can('agents.view') }, async (req, reply) => reply.ok(await agentDto(await getA(req), { full: true })))

  // Activation is a separate authorized step after registration.
  app.post('/agents/:agentId/activate', { preHandler: can('agents.manage') }, async (req, reply) => {
    const a = await getA(req)
    if (!['pending'].includes(a.status)) throw conflict(`Agent is ${a.status}; use unfreeze for frozen agents`)
    const row = await tx(async (c) => { const r = await c.update('agents', { id: a.id }, { status: 'active' }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.activate', target: { type: 'agent', id: a.id } }); return r })
    reply.ok(await agentDto(row))
  })

  app.patch('/agents/:agentId', { preHandler: can('agents.manage') }, async (req, reply) => {
    const b = parse(agentBody.partial().omit({ name: true }).strict(), req.body)
    const a = await getA(req)
    await validateRefs(req, { allowedChains: b.allowedChains || a.allowedChains, controlledWalletIds: b.controlledWalletIds, ownerUserId: b.ownerUserId })
    const row = await tx(async (c) => {
      const r = await c.update('agents', { id: a.id }, { description: b.description, ownerUserId: b.ownerUserId, environment: b.environment, allowedChains: b.allowedChains, controlledWalletIds: b.controlledWalletIds,
        perTxLimits: b.perTxLimits && J(b.perTxLimits), periodLimits: b.periodLimits && J(b.periodLimits), periodHours: b.periodHours, approvalThreshold: b.approvalThreshold && J(b.approvalThreshold), expiresAt: b.expiresAt && new Date(b.expiresAt) })
      if (b.tools) { await c.q('DELETE FROM agent_tool_permissions WHERE agent_id = $1', [a.id]); for (const t of b.tools) await c.insert('agent_tool_permissions', { id: newId('atp'), agentId: a.id, tool: t }) }
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.update', target: { type: 'agent', id: a.id }, metadata: { fields: Object.keys(b), before: { tools: undefined, perTxLimits: a.perTxLimits, periodLimits: a.periodLimits } } })
      return r
    })
    reply.ok(await agentDto(row, { full: true }))
  })
  app.get('/agents/:agentId/permissions', { preHandler: can('agents.view') }, async (req, reply) => { const d = await agentDto(await getA(req)); reply.ok({ tools: d.permittedActions, available: AGENT_TOOLS, allowedChains: d.allowedChains, controlledWalletIds: d.controlledWalletIds }) })
  app.get('/agents/:agentId/limits', { preHandler: can('agents.view') }, async (req, reply) => reply.ok((await agentDto(await getA(req))).limits))
  app.get('/agents/:agentId/activity', { preHandler: can('agents.view') }, async (req, reply) => reply.ok({ items: (await agentDto(await getA(req), { full: true })).activity }))
  app.get('/agents/:agentId/blocked-requests', { preHandler: can('agents.view') }, async (req, reply) => reply.ok({ items: (await agentDto(await getA(req), { full: true })).blockedRequests }))

  // Freeze blocks new actions immediately. It does not cancel transactions already broadcast.
  app.post('/agents/:agentId/freeze', { preHandler: can('agents.freeze') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().trim().min(3).max(500) }), req.body)
    const a = await getA(req)
    if (a.status === 'frozen') throw conflict('Agent is already frozen')
    const row = await tx(async (c) => {
      const r = await c.update('agents', { id: a.id }, { status: 'frozen', frozenAt: new Date(), frozenReason: b.reason })
      const pend = await c.q(`UPDATE spend_intents SET status = 'cancelled', updated_at = now() WHERE agent_id = $1 AND status IN ('draft','pending_approval') RETURNING id`, [a.id])
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.freeze', target: { type: 'agent', id: a.id }, metadata: { reason: b.reason, cancelledPendingIntents: pend.map((p) => p.id) } })
      await openIncident(c, { workspaceId: req.ws.id, type: 'security', category: 'agent_freeze', severity: 'medium', title: `Agent "${a.name}" frozen`, description: b.reason, sourceRef: a.id })
      return { r, pend }
    })
    reply.ok({ ...(await agentDto(row.r)), cancelledPendingIntents: row.pend.map((p) => p.id), note: 'Approved or already-submitted transactions are not cancelled automatically; review them in Spend intents.' })
  })
  app.post('/agents/:agentId/unfreeze', { preHandler: can('agents.manage') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().trim().min(3).max(500) }), req.body)
    const a = await getA(req)
    if (a.status !== 'frozen') throw conflict('Agent is not frozen')
    const row = await tx(async (c) => { const r = await c.update('agents', { id: a.id }, { status: 'active', frozenAt: null, frozenReason: null }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.unfreeze', target: { type: 'agent', id: a.id }, metadata: { reason: b.reason } }); return r })
    reply.ok(await agentDto(row))
  })
  app.post('/agents/:agentId/disable', { preHandler: can('agents.manage') }, async (req, reply) => {
    const a = await getA(req)
    const row = await tx(async (c) => {
      const r = await c.update('agents', { id: a.id }, { status: 'disabled' })
      await c.q(`UPDATE agent_credentials SET status = 'revoked', revoked_at = now() WHERE agent_id = $1 AND status = 'active'`, [a.id])
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.disable', target: { type: 'agent', id: a.id } })
      return r
    })
    reply.ok(await agentDto(row))
  })

  // ── credentials: shown once, stored as keyed hash, never returned again ──
  app.get('/agents/:agentId/credentials', { preHandler: can('agents.view') }, async (req, reply) => reply.ok({ items: (await agentDto(await getA(req), { full: true })).credentials }))
  const issue = async (c, req, a, label, expiresInDays) => {
    const secret = secretToken('pgk_live_')
    const row = await c.insert('agent_credentials', { id: newId('acr'), agentId: a.id, label, prefix: secret.slice(0, 14) + '…', secretHash: hashToken(secret), expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400_000) : a.expiresAt })
    return { secret, row }
  }
  app.post('/agents/:agentId/credentials', { preHandler: can('agents.manage') }, async (req, reply) => {
    const b = parse(z.object({ label: z.string().trim().min(1).max(60).default('Primary key'), expiresInDays: z.number().int().min(1).max(365).optional() }), req.body)
    const a = await getA(req)
    if (a.status !== 'active') throw conflict('Credentials can only be issued to an active (authorized) agent', 'AGENT_NOT_ACTIVE')
    const out = await tx(async (c) => { const o = await issue(c, req, a, b.label, b.expiresInDays); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.credential.issue', target: { type: 'agent_credential', id: o.row.id }, metadata: { agentId: a.id } }); return o })
    reply.ok({ id: out.row.id, label: out.row.label, prefix: out.row.prefix, expiresAt: out.row.expiresAt, secret: out.secret, secretShownOnce: true }, {}, 201)
  })
  app.post('/agents/:agentId/credentials/:credId/rotate', { preHandler: can('agents.manage') }, async (req, reply) => {
    const a = await getA(req)
    if (a.status !== 'active') throw conflict('Agent must be active to rotate credentials', 'AGENT_NOT_ACTIVE')
    const out = await tx(async (c) => {
      const old = await c.one(`UPDATE agent_credentials SET status = 'revoked', revoked_at = now() WHERE id = $1 AND agent_id = $2 AND status = 'active' RETURNING *`, [req.params.credId, a.id])
      if (!old) throw notFound('Active credential')
      const o = await issue(c, req, a, old.label, null)
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.credential.rotate', target: { type: 'agent_credential', id: o.row.id }, metadata: { replaced: old.id } })
      return o
    })
    reply.ok({ id: out.row.id, label: out.row.label, prefix: out.row.prefix, secret: out.secret, secretShownOnce: true, replacedCredentialRevoked: true })
  })
  app.delete('/agents/:agentId/credentials/:credId', { preHandler: can('agents.freeze') }, async (req, reply) => {
    const a = await getA(req)
    const r = await db.one(`UPDATE agent_credentials SET status = 'revoked', revoked_at = now() WHERE id = $1 AND agent_id = $2 AND status = 'active' RETURNING id`, [req.params.credId, a.id])
    if (!r) throw notFound('Active credential')
    await audit(null, { workspaceId: req.ws.id, actor: actor(req), action: 'agent.credential.revoke', target: { type: 'agent_credential', id: r.id } })
    reply.ok({ revoked: true })
  })
}
