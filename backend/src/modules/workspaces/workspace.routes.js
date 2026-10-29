import { z } from 'zod'
import { db, tx } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { capsForRole } from '../../shared/permissions.js'
import { newId, secretToken } from '../../shared/ids.js'
import { hashToken } from '../../shared/crypto.js'
import { notFound } from '../../shared/errors.js'
import { audit } from '../audit/audit.service.js'
import { svc } from '../../services/registry.js'
import { env } from '../../config/env.js'
import { CHAINS } from '../../shared/chains.js'

const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })

export default async function (app) {
  app.get('', { preHandler: can('workspace.view') }, async (req, reply) => {
    const w = await db.one('SELECT id, name, slug, status, settings, created_at FROM workspaces WHERE id = $1', [req.ws.id])
    return reply.ok({ ...w, role: req.ws.membership.role, capabilities: capsForRole(req.ws.membership.role) })
  })

  app.patch('', { preHandler: can('workspace.settings') }, async (req, reply) => {
    const b = parse(z.object({
      name: z.string().trim().min(2).max(80).optional(),
      settings: z.object({
        alertPreferences: z.array(z.enum(['suspicious_recipient', 'approval_change', 'agent_block', 'scan_completed', 'execution'])).optional(),
        dataRetentionDays: z.number().int().min(30).max(3650).optional(),
        defaultChainId: z.number().int().optional(),
        deletionRequestedAt: z.never().optional(),
      }).strict().optional(),
    }), req.body)
    const cur = await db.one('SELECT settings FROM workspaces WHERE id = $1', [req.ws.id])
    const w = await tx(async (c) => {
      const row = await c.update('workspaces', { id: req.ws.id }, { name: b.name, settings: b.settings ? { ...cur.settings, ...b.settings } : undefined })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'workspace.update', target: { type: 'workspace', id: req.ws.id }, metadata: { fields: Object.keys(b) } })
      return row
    })
    return reply.ok(w)
  })

  app.post('/deletion-request', { preHandler: can('workspace.delete') }, async (req, reply) => {
    const b = parse(z.object({ confirmName: z.string(), reason: z.string().max(500).optional() }), req.body)
    if (b.confirmName !== req.ws.name) throw notFound('Matching workspace name') // explicit confirmation
    const cur = await db.one('SELECT settings FROM workspaces WHERE id = $1', [req.ws.id])
    await tx(async (c) => {
      await c.update('workspaces', { id: req.ws.id }, { settings: { ...cur.settings, deletionRequestedAt: new Date().toISOString(), deletionRequestedBy: req.ctx.user.id } })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'workspace.deletion_requested', metadata: { reason: b.reason } })
    })
    return reply.ok({ requested: true, note: 'Deletion is processed by platform staff after a cooling-off period. Audit records are retained per the retention policy.' })
  })

  // ── overview (separate counters: authorized ≠ signed ≠ confirmed) ──
  app.get('/overview', { preHandler: can('workspace.view') }, async (req, reply) => {
    const q = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30), chainId: z.coerce.number().int().optional() }), req.query)
    const w = req.ws.id, since = new Date(Date.now() - q.days * 86400_000)
    const chainF = q.chainId ? ` AND chain_id = ${Number(q.chainId)}` : ''
    const [wallets, agents, scans, intents, events, recentIntents, agentUsage] = await Promise.all([
      db.one(`SELECT count(*) FILTER (WHERE status = 'active')::int AS active, count(*) FILTER (WHERE status = 'paused')::int AS paused FROM watched_wallets WHERE workspace_id = $1 AND status <> 'removed'${chainF}`, [w]),
      db.one(`SELECT count(*) FILTER (WHERE status = 'active')::int AS active, count(*) FILTER (WHERE status = 'frozen')::int AS frozen, count(*)::int AS total FROM agents WHERE workspace_id = $1`, [w]),
      db.one(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('failed','timed_out'))::int AS failed, count(*) FILTER (WHERE risk_label IN ('high','critical'))::int AS high_risk FROM scans WHERE workspace_id = $1 AND requested_at >= $2${chainF}`, [w, since]),
      db.one(`SELECT count(*) FILTER (WHERE status = 'pending_approval')::int AS pending_approval, count(*) FILTER (WHERE status = 'denied')::int AS denied,
        count(*) FILTER (WHERE status IN ('approved','ready_to_sign'))::int AS authorized_awaiting_signature, count(*) FILTER (WHERE status = 'submitted')::int AS submitted_awaiting_confirmation,
        count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_on_chain, count(*) FILTER (WHERE status IN ('reconciliation_mismatch','reverted','failed'))::int AS execution_problems
        FROM spend_intents WHERE workspace_id = $1 AND created_at >= $2${chainF}`, [w, since]),
      db.q(`SELECT id, severity, category, title, status, opened_at FROM security_incidents WHERE workspace_id = $1 ORDER BY opened_at DESC LIMIT 5`, [w]),
      db.q(`SELECT id, status, amount, asset_symbol, to_address, created_at FROM spend_intents WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 5`, [w]),
      db.q(`SELECT a.id, a.name, a.status, a.period_limits, a.period_hours, coalesce(json_agg(json_build_object('asset', CASE WHEN s.asset_type = 'native' THEN 'native' ELSE s.token_address END, 'chainId', s.chain_id, 'amount', s.amount)) FILTER (WHERE s.id IS NOT NULL), '[]') AS committed
        FROM agents a LEFT JOIN spend_intents s ON s.agent_id = a.id AND s.status IN ('pending_approval','approved','ready_to_sign','submitted','confirmed') AND s.created_at > now() - (a.period_hours || ' hours')::interval
        WHERE a.workspace_id = $1 GROUP BY a.id`, [w]),
    ])
    const usage = agentUsage.map((a) => ({ agentId: a.id, name: a.name, status: a.status, periodHours: a.periodHours, limits: (a.periodLimits || []).map((l) => ({ ...l, committed: a.committed.filter((x) => x.asset === l.asset && x.chainId === Number(l.chainId)).reduce((s, x) => s + BigInt(x.amount), 0n).toString() })) }))
    const integrations = CHAINS.filter((c) => c.environment !== 'testnet').map((c) => ({ chainId: c.id, network: c.key, rpcConfigured: !!env[c.rpcEnvVar] }))
    return reply.ok({
      periodDays: q.days, wallets, agents, scans, intents, recentSecurityEvents: events, recentIntents, agentUsage: usage,
      integrationHealth: { chains: integrations, indexerConfigured: !!svc('chains').indexer(), warning: integrations.some((i) => !i.rpcConfigured) ? 'Some networks have no RPC configured; scans and evaluations on them are incomplete.' : null },
      note: 'Authorized (approved), signed/submitted and confirmed-on-chain are reported separately by design.',
    })
  })

  // ── API keys (workspace-scoped, read-only scanner access) ──
  app.get('/api-keys', { preHandler: can('apikeys.manage') }, async (req, reply) => {
    reply.ok({ items: await db.q(`SELECT id, label, prefix, scopes, status, last_used_at, expires_at, created_at, revoked_at FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC`, [req.ws.id]) })
  })
  app.post('/api-keys', { preHandler: can('apikeys.manage') }, async (req, reply) => {
    const b = parse(z.object({ label: z.string().trim().min(1).max(80), scopes: z.array(z.enum(['scans:read', 'scans:write', 'recipients:check'])).min(1), expiresInDays: z.number().int().min(1).max(365).optional() }), req.body)
    const secret = secretToken('pgk_ws_')
    const row = await tx(async (c) => {
      const r = await c.insert('api_keys', { id: newId('key'), workspaceId: req.ws.id, label: b.label, prefix: secret.slice(0, 14) + '…', secretHash: hashToken(secret), scopes: b.scopes, createdById: req.ctx.user.id, expiresAt: b.expiresInDays ? new Date(Date.now() + b.expiresInDays * 86400_000) : null })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'api_key.create', target: { type: 'api_key', id: r.id }, metadata: { scopes: b.scopes } })
      return r
    })
    return reply.ok({ id: row.id, label: row.label, prefix: row.prefix, scopes: row.scopes, expiresAt: row.expiresAt, secret, secretShownOnce: true }, {}, 201)
  })
  app.delete('/api-keys/:keyId', { preHandler: can('apikeys.manage') }, async (req, reply) => {
    const r = await db.one(`UPDATE api_keys SET status = 'revoked', revoked_at = now() WHERE id = $1 AND workspace_id = $2 AND status = 'active' RETURNING id`, [req.params.keyId, req.ws.id])
    if (!r) throw notFound('API key')
    await audit(null, { workspaceId: req.ws.id, actor: actor(req), action: 'api_key.revoke', target: { type: 'api_key', id: r.id } })
    return reply.ok({ revoked: true })
  })
}
