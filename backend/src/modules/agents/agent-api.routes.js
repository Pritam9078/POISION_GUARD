import { z } from 'zod'
import { db, J } from '../../db/index.js'
import { parse, zAddress, zBaseUnits } from '../../shared/validate.js'
import { hashToken } from '../../shared/crypto.js'
import { AppError, unauthorized, notFound } from '../../shared/errors.js'
import { newId } from '../../shared/ids.js'
import { resolveChain } from '../../shared/chains.js'
import { checkRecipient } from '../recipients/check.service.js'
import { createScan } from '../public/public.routes.js'
import { createIntent, evaluateIntent, intentDto } from '../intents/intents.service.js'
import { scanDto } from '../scanner/scan.service.js'

/**
 * Machine API for registered agents. Bearer pgk_live_… credential.
 * Agents can only PROPOSE: every transfer becomes a spend intent evaluated by the policy engine.
 * There is no endpoint that lets an agent approve, sign or broadcast.
 */
async function agentAuth(req) {
  const h = req.headers.authorization || ''
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : null
  if (!tok || !tok.startsWith('pgk_live_')) throw unauthorized('Agent credential required (Authorization: Bearer pgk_live_…)')
  const r = await db.one(`SELECT c.id AS cred_id, c.status AS cred_status, c.expires_at AS cred_expires, a.*, ws.status AS ws_status FROM agent_credentials c JOIN agents a ON a.id = c.agent_id JOIN workspaces ws ON ws.id = a.workspace_id WHERE c.secret_hash = $1`, [hashToken(tok)])
  if (!r || r.credStatus !== 'active' || (r.credExpires && new Date(r.credExpires) < new Date())) throw unauthorized('Agent credential is invalid, revoked or expired')
  if (r.status !== 'active') throw new AppError(403, 'AGENT_NOT_ACTIVE', `Agent is ${r.status}`)
  if (new Date(r.expiresAt) < new Date()) throw new AppError(403, 'AGENT_EXPIRED', 'Agent registration has expired')
  if (r.wsStatus !== 'active') throw new AppError(403, 'WORKSPACE_SUSPENDED', 'Workspace is suspended')
  db.q('UPDATE agent_credentials SET last_used_at = now() WHERE id = $1', [r.credId]).catch(() => {})
  const tools = (await db.q('SELECT tool FROM agent_tool_permissions WHERE agent_id = $1', [r.id])).map((t) => t.tool)
  req.ctx.agent = { ...r, tools }
}

async function requireTool(req, tool, detail = {}) {
  const a = req.ctx.agent
  if (!a.tools.includes(tool)) {
    await db.insert('agent_requests', { id: newId('arq'), agentId: a.id, workspaceId: a.workspaceId, tool, outcome: 'blocked', reason: `Tool "${tool}" not in allowlist`, detail: J(detail) })
    throw new AppError(403, 'TOOL_NOT_PERMITTED', `This agent is not permitted to use "${tool}"`)
  }
}
const chainOf = (v) => { const c = resolveChain(v); if (!c) throw new AppError(400, 'VALIDATION_ERROR', 'Unsupported chain'); return c }

export default async function (app) {
  app.addHook('preHandler', agentAuth)

  app.get('/v1/me', async (req, reply) => {
    const a = req.ctx.agent
    reply.ok({ id: a.id, name: a.name, workspaceId: a.workspaceId, tools: a.tools, allowedChains: a.allowedChains, controlledWalletIds: a.controlledWalletIds, expiresAt: a.expiresAt })
  })

  app.post('/v1/check-recipient', async (req, reply) => {
    await requireTool(req, 'check_recipient')
    const b = parse(z.object({ chainId: z.union([z.number(), z.string()]), address: zAddress, senderAddress: zAddress.optional() }), req.body)
    const chain = chainOf(b.chainId)
    if (!req.ctx.agent.allowedChains.includes(chain.id)) throw new AppError(403, 'AGENT_CHAIN_NOT_ALLOWED', 'Chain not in agent allowlist')
    const out = await checkRecipient({ chainId: chain.id, address: b.address, senderAddress: b.senderAddress, workspaceId: req.ctx.agent.workspaceId })
    await db.insert('agent_requests', { id: newId('arq'), agentId: req.ctx.agent.id, workspaceId: req.ctx.agent.workspaceId, tool: 'check_recipient', outcome: 'allowed', reason: `result=${out.result}`, detail: J({ address: b.address }) })
    reply.ok(out)
  })

  app.post('/v1/scans', async (req, reply) => {
    await requireTool(req, 'scan_wallet')
    const b = parse(z.object({ chainId: z.union([z.number(), z.string()]), input: z.string().max(100) }), req.body)
    const chain = chainOf(b.chainId)
    if (!req.ctx.agent.allowedChains.includes(chain.id)) throw new AppError(403, 'AGENT_CHAIN_NOT_ALLOWED', 'Chain not in agent allowlist')
    const out = await createScan({ chain, input: b.input, workspaceId: req.ctx.agent.workspaceId, agentId: req.ctx.agent.id })
    await db.insert('agent_requests', { id: newId('arq'), agentId: req.ctx.agent.id, workspaceId: req.ctx.agent.workspaceId, tool: 'scan_wallet', outcome: 'allowed', reason: 'scan queued', detail: J({ scanId: out.scanId }) })
    reply.ok({ ...out, pollUrl: `/api/v1/agent/v1/scans/${out.scanId}` }, {}, 202)
  })
  app.get('/v1/scans/:scanId', async (req, reply) => {
    const s = await db.one('SELECT id FROM scans WHERE id = $1 AND workspace_id = $2 AND agent_id = $3', [req.params.scanId, req.ctx.agent.workspaceId, req.ctx.agent.id])
    if (!s) throw notFound('Scan')
    reply.ok(await scanDto(s.id))
  })

  app.post('/v1/spend-intents', async (req, reply) => {
    const b = parse(z.object({ walletId: z.string(), chainId: z.union([z.number(), z.string()]), toAddress: zAddress, assetType: z.enum(['native', 'erc20']), tokenAddress: zAddress.optional(), amount: zBaseUnits, purpose: z.string().trim().min(3).max(500), reference: z.string().max(120).optional(), idempotencyKey: z.string().min(8).max(80).optional(), expiresAt: z.string().datetime().optional() }), req.body)
    await requireTool(req, 'propose_transfer', { to: b.toAddress, amount: b.amount })
    const chain = chainOf(b.chainId)
    const idem = req.headers['idempotency-key'] || b.idempotencyKey
    const { intent, replayed } = await createIntent(req.ctx.agent.workspaceId, { type: 'agent', agent: req.ctx.agent }, { ...b, chainId: chain.id, idempotencyKey: idem })
    if (replayed) return reply.ok({ ...(await intentDto(intent)), replayed: true })
    const ev = await evaluateIntent(req.ctx.agent.workspaceId, intent.id, { type: 'agent', agent: req.ctx.agent })
    reply.ok({ ...(await intentDto(ev.intent)), decision: ev.evaluation.decision, reasonCodes: ev.evaluation.reasonCodes, note: 'This is a proposal. Execution requires policy approval and a signature from the authorized wallet.' }, {}, 201)
  })
  app.get('/v1/spend-intents/:intentId', async (req, reply) => {
    const i = await db.one('SELECT * FROM spend_intents WHERE id = $1 AND agent_id = $2', [req.params.intentId, req.ctx.agent.id])
    if (!i) throw notFound('Spend intent')
    const d = await intentDto(i)
    reply.ok({ id: d.id, status: d.status, decision: d.policyResult?.verdict, reasonCodes: d.policyResult?.reasonCodes, requiredApprovals: d.requiredApprovals, approvalsCount: d.approvals.filter((a) => a.decision === 'approved' && a.boundToCurrentParams).length, execution: d.execution })
  })
}
