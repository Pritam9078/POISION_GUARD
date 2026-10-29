import { z } from 'zod'
import { db, tx, J } from '../../db/index.js'
import { parse, zAddress, zBaseUnits } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { newId } from '../../shared/ids.js'
import { notFound, conflict, badRequest } from '../../shared/errors.js'
import { audit } from '../audit/audit.service.js'
import { evaluate, validatePolicyConfig } from './engine.js'
import { counterpartyContext, loadAgent } from '../intents/intents.service.js'
import { canonicalJson } from '../../shared/crypto.js'

const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })

function diff(a, b, path = '') {
  if (canonicalJson(a) === canonicalJson(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diff(a[k], b[k], path ? `${path}.${k}` : k))
  }
  return [{ path: path || '(root)', from: a ?? null, to: b ?? null }]
}

async function policyDto(p, { full = false } = {}) {
  const versions = await db.q(`SELECT v.id, v.version, v.status, v.change_note, v.created_at, v.activated_at, v.based_on_id, v.config, u.name AS by, (SELECT count(*)::int FROM policy_evaluations e WHERE e.simulated AND v.id = ANY(e.policy_version_ids)) AS simulations
    FROM policy_versions v LEFT JOIN users u ON u.id = v.created_by_id WHERE v.policy_id = $1 ORDER BY v.version DESC`, [p.id])
  const active = versions.find((v) => v.id === p.activeVersionId)
  const latest = versions[0]
  const cfg = (active || latest)?.config || {}
  const rules = [
    ...(cfg.limits || []).flatMap((l) => [l.perTx && { category: 'Limit', rule: 'max_tx', config: `${l.perTx} base units of ${l.asset} on ${l.chainId}` }, l.perPeriod && { category: 'Limit', rule: 'period_limit', config: `${l.perPeriod} per ${l.periodHours}h of ${l.asset} on ${l.chainId}` }]).filter(Boolean),
    cfg.recipients && { category: 'Allowlist', rule: 'recipients', config: `mode=${cfg.recipients.mode}, untrusted=${cfg.recipients.untrusted}, blocked=${cfg.recipients.blocked?.length ?? 0}` },
    cfg.allowedChains && { category: 'Network', rule: 'permitted_networks', config: cfg.allowedChains.join(', ') },
    cfg.allowedTokens && { category: 'Asset', rule: 'permitted_tokens', config: cfg.allowedTokens.join(', ') },
    cfg.risk && { category: 'Risk', rule: 'risk', config: `deny on poisoning finding: ${cfg.risk.denyOnPoisoningFinding}; deny on lookalike of trusted: ${cfg.risk.denyOnLookalikeOfTrusted}` },
    cfg.approvals && { category: 'Approval', rule: 'required_approvals', config: `${cfg.approvals.required} approver(s)${cfg.approvals.thresholds?.length ? `, ${cfg.approvals.thresholds.length} threshold(s)` : ''}` },
    cfg.timeWindow && { category: 'Time', rule: 'time_window', config: JSON.stringify(cfg.timeWindow) },
    cfg.intelligenceUnavailable && { category: 'Emergency', rule: 'intelligence_unavailable', config: cfg.intelligenceUnavailable },
  ].filter(Boolean)
  const creator = await db.one('SELECT name FROM users WHERE id = $1', [p.createdById])
  const base = { id: p.id, name: p.name, description: p.description, status: p.status, priority: p.priority, version: active?.version ?? null, latestVersion: latest?.version ?? null, activeVersionId: p.activeVersionId,
    scope: describeScope(cfg.appliesTo), createdBy: creator?.name, createdAt: p.createdAt, updatedAt: p.updatedAt, rules }
  if (!full) return base
  const activations = await db.q(`SELECT created_at AS at, actor_label AS by, action, metadata FROM audit_events WHERE workspace_id = $1 AND target_type = 'policy' AND target_id = $2 AND action IN ('policy.activate','policy.rollback','policy.disable') ORDER BY seq DESC`, [p.workspaceId, p.id])
  return { ...base, config: cfg, versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, at: v.createdAt, by: v.by, change: v.changeNote, activatedAt: v.activatedAt, basedOnId: v.basedOnId, simulations: v.simulations, config: v.config })),
    activations: activations.map((a) => ({ at: a.at, by: a.by, action: a.action, note: a.metadata?.note ?? '', version: a.metadata?.version })) }
}
const describeScope = (a = {}) => {
  const parts = []
  if (a.walletIds?.length) parts.push(`${a.walletIds.length} wallet(s)`)
  if (a.agentIds?.length) parts.push(`${a.agentIds.length} agent(s)`)
  if (a.chainIds?.length) parts.push(`chains ${a.chainIds.join(',')}`)
  if (a.requesterTypes?.length) parts.push(a.requesterTypes.join('/'))
  return parts.length ? `Workspace · ${parts.join(' · ')}` : 'Workspace · all wallets & agents'
}

export default async function (app) {
  const getP = async (req) => {
    const p = await db.one('SELECT * FROM policies WHERE id = $1 AND workspace_id = $2', [req.params.policyId, req.ws.id])
    if (!p) throw notFound('Policy')
    return p
  }
  const cfgOrThrow = (cfg) => { const v = validatePolicyConfig(cfg); if (!v.ok) throw badRequest(`Invalid policy: ${v.errors[0]}`, { errors: v.errors }); return v.config }

  app.get('/policies', { preHandler: can('policies.view') }, async (req, reply) => {
    const rows = await db.q('SELECT * FROM policies WHERE workspace_id = $1 ORDER BY priority, created_at', [req.ws.id])
    reply.ok({ items: await Promise.all(rows.map((p) => policyDto(p))) })
  })

  app.post('/policies', { preHandler: can('policies.edit') }, async (req, reply) => {
    const b = parse(z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).default(''), priority: z.number().int().min(1).max(1000).default(100), config: z.record(z.string(), z.any()), changeNote: z.string().trim().max(300).default('Initial version') }), req.body)
    const config = cfgOrThrow(b.config)
    const p = await tx(async (c) => {
      const row = await c.insert('policies', { id: newId('pol'), workspaceId: req.ws.id, name: b.name, description: b.description, priority: b.priority, status: 'draft', createdById: req.ctx.user.id, updatedById: req.ctx.user.id })
      await c.insert('policy_versions', { id: newId('pov'), policyId: row.id, version: 1, config: J(config), changeNote: b.changeNote, createdById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'policy.create', target: { type: 'policy', id: row.id } })
      return row
    })
    reply.ok(await policyDto(p, { full: true }), {}, 201)
  })

  app.post('/policies/validate', { preHandler: can('policies.view') }, async (req, reply) => {
    const v = validatePolicyConfig(req.body?.config)
    reply.ok(v.ok ? { valid: true, normalized: v.config } : { valid: false, errors: v.errors })
  })

  // Simulator: evaluates without creating or executing anything. Simulations are recorded (required before activation).
  app.post('/policies/simulate', { preHandler: can('policies.view') }, async (req, reply) => {
    const b = parse(z.object({
      policyVersionIds: z.array(z.string()).optional(), draftConfig: z.record(z.string(), z.any()).optional(), includeActive: z.boolean().default(true),
      input: z.object({ walletId: z.string().optional(), agentId: z.string().optional(), chainId: z.number().int(), toAddress: zAddress, assetType: z.enum(['native', 'erc20']), tokenAddress: zAddress.optional(), amount: zBaseUnits, requestedByUserId: z.string().optional() }),
      intelligence: z.object({ available: z.boolean().optional(), recipientFindings: z.array(z.object({ ruleId: z.string(), severity: z.string() })).optional() }).optional(),
    }), req.body)
    const pols = []
    if (b.includeActive) pols.push(...(await db.q(`SELECT p.id AS policy_id, p.name, pv.id AS version_id, pv.version, pv.config FROM policies p JOIN policy_versions pv ON pv.id = p.active_version_id WHERE p.workspace_id = $1 AND p.status = 'active' AND NOT (pv.id = ANY($2))`, [req.ws.id, b.policyVersionIds || []])).map((r) => ({ policyId: r.policyId, name: r.name, versionId: r.versionId, version: r.version, config: r.config })))
    if (b.policyVersionIds?.length) {
      const vs = await db.q(`SELECT v.id, v.version, v.config, p.id AS policy_id, p.name FROM policy_versions v JOIN policies p ON p.id = v.policy_id WHERE v.id = ANY($1) AND p.workspace_id = $2`, [b.policyVersionIds, req.ws.id])
      if (vs.length !== b.policyVersionIds.length) throw notFound('Policy version')
      pols.push(...vs.map((v) => ({ policyId: v.policyId, name: v.name, versionId: v.id, version: v.version, config: v.config })))
    }
    if (b.draftConfig) pols.push({ policyId: 'draft', name: 'Unsaved draft', versionId: null, version: null, config: cfgOrThrow(b.draftConfig) })
    const ctx = await counterpartyContext(req.ws.id, b.input.chainId, b.input.toAddress)
    if (b.intelligence?.available !== undefined) ctx.intelligenceAvailable = b.intelligence.available
    if (b.intelligence?.recipientFindings) ctx.recipientFindings = b.intelligence.recipientFindings
    const agent = await loadAgent(b.input.agentId)
    if (b.input.agentId && (!agent || agent.workspaceId !== req.ws.id)) throw notFound('Agent')
    const result = evaluate({ ...b.input, tokenAddress: b.input.tokenAddress ?? null }, pols, { ...ctx, agent, spent: () => 0n, now: new Date() })
    const ev = await db.insert('policy_evaluations', { id: newId('pev'), workspaceId: req.ws.id, policyVersionIds: pols.map((p) => p.versionId).filter(Boolean), input: J({ ...b.input, intelligence: b.intelligence }), results: J(result.results), decision: result.decision, reasonCodes: result.reasonCodes, requiredApprovals: result.requiredApprovals, simulated: true })
    const missing = [!ctx.intelligenceAvailable && 'Chain data unavailable for this network', ...(b.input.agentId ? [] : [])].filter(Boolean)
    reply.ok({ simulationId: ev.id, ...result, missingEvidence: missing, note: 'Simulation only. Period-limit usage is assumed to be 0 in simulations.' })
  })

  app.get('/policies/:policyId', { preHandler: can('policies.view') }, async (req, reply) => reply.ok(await policyDto(await getP(req), { full: true })))

  app.patch('/policies/:policyId', { preHandler: can('policies.edit') }, async (req, reply) => {
    const b = parse(z.object({ name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(500).optional(), priority: z.number().int().min(1).max(1000).optional() }).strict(), req.body)
    const p = await getP(req)
    const row = await tx(async (c) => { const r = await c.update('policies', { id: p.id }, { ...b, updatedById: req.ctx.user.id }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'policy.update_meta', target: { type: 'policy', id: p.id }, metadata: b }); return r })
    reply.ok(await policyDto(row))
  })

  // Versions are immutable. Editing = creating a new draft version.
  app.post('/policies/:policyId/versions', { preHandler: can('policies.edit') }, async (req, reply) => {
    const b = parse(z.object({ config: z.record(z.string(), z.any()), changeNote: z.string().trim().min(3).max(300) }), req.body)
    const config = cfgOrThrow(b.config)
    const p = await getP(req)
    const v = await tx(async (c) => {
      const last = await c.one('SELECT id, version FROM policy_versions WHERE policy_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE', [p.id])
      const row = await c.insert('policy_versions', { id: newId('pov'), policyId: p.id, version: last.version + 1, config: J(config), changeNote: b.changeNote, basedOnId: last.id, createdById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'policy.version.create', target: { type: 'policy', id: p.id }, metadata: { version: row.version } })
      return row
    })
    reply.ok(v, {}, 201)
  })
  app.get('/policies/:policyId/versions', { preHandler: can('policies.view') }, async (req, reply) => reply.ok({ items: (await policyDto(await getP(req), { full: true })).versions }))

  app.get('/policies/:policyId/diff', { preHandler: can('policies.view') }, async (req, reply) => {
    const q = parse(z.object({ from: z.coerce.number().int(), to: z.coerce.number().int() }), req.query)
    const p = await getP(req)
    const [a, b] = await Promise.all([db.one('SELECT config FROM policy_versions WHERE policy_id = $1 AND version = $2', [p.id, q.from]), db.one('SELECT config FROM policy_versions WHERE policy_id = $1 AND version = $2', [p.id, q.to])])
    if (!a || !b) throw notFound('Policy version')
    reply.ok({ from: q.from, to: q.to, changes: diff(a.config, b.config) })
  })

  app.get('/policies/:policyId/history', { preHandler: can('policies.view') }, async (req, reply) => {
    await getP(req)
    reply.ok({ items: await db.q(`SELECT id, seq, created_at AS at, actor_label AS by, action, metadata FROM audit_events WHERE workspace_id = $1 AND target_type = 'policy' AND target_id = $2 ORDER BY seq DESC`, [req.ws.id, req.params.policyId]) })
  })

  // Activation requires: a valid version, at least one recorded simulation of that version, and policies.activate.
  app.post('/policies/:policyId/activate', { preHandler: can('policies.activate') }, async (req, reply) => {
    const b = parse(z.object({ version: z.number().int(), note: z.string().trim().max(300).default('') }), req.body)
    const p = await getP(req)
    const row = await tx(async (c) => {
      const v = await c.one('SELECT * FROM policy_versions WHERE policy_id = $1 AND version = $2 FOR UPDATE', [p.id, b.version])
      if (!v) throw notFound('Policy version')
      if (v.status === 'active') throw conflict('That version is already active')
      cfgOrThrow(v.config)
      const sims = await c.one('SELECT count(*)::int AS n FROM policy_evaluations WHERE simulated AND $1 = ANY(policy_version_ids)', [v.id])
      if (!sims.n) throw conflict('Run the policy simulator against this version before activating it', 'SIMULATION_REQUIRED')
      await c.q(`UPDATE policy_versions SET status = 'superseded' WHERE policy_id = $1 AND status = 'active'`, [p.id])
      await c.update('policy_versions', { id: v.id }, { status: 'active', activatedAt: new Date(), activatedById: req.ctx.user.id })
      const r = await c.update('policies', { id: p.id }, { status: 'active', activeVersionId: v.id, updatedById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'policy.activate', target: { type: 'policy', id: p.id }, metadata: { version: v.version, versionId: v.id, note: b.note } })
      return r
    })
    reply.ok(await policyDto(row, { full: true }))
  })

  // Rollback = new version copying an earlier config, then activate. History is preserved.
  app.post('/policies/:policyId/rollback', { preHandler: can('policies.activate') }, async (req, reply) => {
    const b = parse(z.object({ toVersion: z.number().int(), note: z.string().trim().min(3).max(300) }), req.body)
    const p = await getP(req)
    const row = await tx(async (c) => {
      const src = await c.one('SELECT * FROM policy_versions WHERE policy_id = $1 AND version = $2', [p.id, b.toVersion])
      if (!src) throw notFound('Policy version')
      const last = await c.one('SELECT version FROM policy_versions WHERE policy_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE', [p.id])
      await c.q(`UPDATE policy_versions SET status = 'superseded' WHERE policy_id = $1 AND status = 'active'`, [p.id])
      const nv = await c.insert('policy_versions', { id: newId('pov'), policyId: p.id, version: last.version + 1, config: J(src.config), changeNote: `Rollback to v${src.version}: ${b.note}`, basedOnId: src.id, status: 'active', createdById: req.ctx.user.id, activatedAt: new Date(), activatedById: req.ctx.user.id })
      const r = await c.update('policies', { id: p.id }, { status: 'active', activeVersionId: nv.id, updatedById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'policy.rollback', target: { type: 'policy', id: p.id }, metadata: { version: nv.version, fromVersion: src.version, note: b.note } })
      return r
    })
    reply.ok(await policyDto(row, { full: true }))
  })

  app.post('/policies/:policyId/disable', { preHandler: can('policies.activate') }, async (req, reply) => {
    const b = parse(z.object({ note: z.string().trim().min(3).max(300) }), req.body)
    const p = await getP(req)
    const row = await tx(async (c) => { const r = await c.update('policies', { id: p.id }, { status: 'disabled', updatedById: req.ctx.user.id }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'policy.disable', target: { type: 'policy', id: p.id }, metadata: { note: b.note } }); return r })
    reply.ok({ ...(await policyDto(row)), warning: 'With no active policy applying, intents default to requiring one human approval.' })
  })
}
