import { z } from 'zod'
import { db, tx, J } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { notFound } from '../../shared/errors.js'
import { newId } from '../../shared/ids.js'
import { audit } from '../audit/audit.service.js'
import { svc } from '../../services/registry.js'
import { createDocument, hybridSearch, answer } from './knowledge.service.js'
import { assertFeature } from '../billing/entitlements.js'
import { flagEnabled } from '../flags/flags.js'
import { findingDto } from '../scanner/scan.service.js'

const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })
const SCOPES = ['members', 'approvers', 'admins']
const visible = (role) => ['members', ...(['owner', 'admin', 'approver'].includes(role) ? ['approvers'] : []), ...(['owner', 'admin'].includes(role) ? ['admins'] : [])]

export default async function (app) {
  app.get('/knowledge', { preHandler: can('knowledge.view') }, async (req, reply) => {
    const rows = await db.q(`SELECT d.*, u.name AS added_by, (SELECT count(*)::int FROM knowledge_chunks c WHERE c.document_id = d.id) AS chunks,
      (SELECT count(*)::int FROM retrieval_logs r WHERE d.id = ANY(SELECT document_id FROM knowledge_chunks WHERE id = ANY(r.chunk_ids))) AS retrieval_count
      FROM knowledge_documents d LEFT JOIN users u ON u.id = d.created_by_id WHERE d.workspace_id = $1 AND d.deleted_at IS NULL AND d.access_scope = ANY($2) ORDER BY d.created_at DESC`, [req.ws.id, visible(req.ws.membership.role)])
    reply.ok({ items: rows.map((d) => ({ id: d.id, title: d.title, source: d.source, type: d.category, category: d.category, status: d.status, addedBy: d.addedBy, addedAt: d.createdAt, access: d.accessScope, size: `${Math.ceil(d.sizeBytes / 1024)} KB`, chunks: d.chunks, retrievalCount: d.retrievalCount, version: d.version, tags: d.tags, error: d.error })) })
  })

  app.post('/knowledge', { preHandler: can('knowledge.manage'), bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const b = parse(z.object({ title: z.string().trim().min(2).max(200), category: z.string().trim().max(60).default('general'), source: z.string().trim().max(200).default('Upload'), accessScope: z.enum(SCOPES).default('members'), retentionDays: z.number().int().min(1).max(3650).optional(), tags: z.array(z.string().max(30)).max(20).default([]), content: z.string().min(20).max(1_500_000) }), req.body)
    const out = await tx(async (c) => {
      const r = await createDocument(c, { workspaceId: req.ws.id, ...b, createdById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'knowledge.add', target: { type: 'document', id: r.doc.id }, metadata: { chunks: r.chunks, accessScope: b.accessScope } })
      return r
    })
    await svc('jobs').enqueue('rag.ingest', { documentId: out.doc.id })
    reply.ok({ id: out.doc.id, title: out.doc.title, status: out.doc.status, chunks: out.chunks }, {}, 201)
  })

  const getD = async (req) => {
    const d = await db.one(`SELECT * FROM knowledge_documents WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND access_scope = ANY($3)`, [req.params.docId, req.ws.id, visible(req.ws.membership.role)])
    if (!d) throw notFound('Document')
    return d
  }
  app.get('/knowledge/:docId', { preHandler: can('knowledge.view') }, async (req, reply) => {
    const d = await getD(req)
    const chunks = await db.q('SELECT id, ordinal, section, left(content, 300) AS preview, embedding IS NOT NULL AS embedded FROM knowledge_chunks WHERE document_id = $1 ORDER BY ordinal', [d.id])
    reply.ok({ ...d, chunks })
  })
  app.patch('/knowledge/:docId/access', { preHandler: can('knowledge.manage') }, async (req, reply) => {
    const b = parse(z.object({ accessScope: z.enum(SCOPES) }), req.body)
    const d = await getD(req)
    await tx(async (c) => {
      await c.update('knowledge_documents', { id: d.id }, { accessScope: b.accessScope })
      await c.q('UPDATE knowledge_chunks SET access_scope = $1 WHERE document_id = $2', [b.accessScope, d.id])
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'knowledge.access_change', target: { type: 'document', id: d.id }, metadata: { from: d.accessScope, to: b.accessScope } })
    })
    reply.ok({ id: d.id, accessScope: b.accessScope })
  })
  app.delete('/knowledge/:docId', { preHandler: can('knowledge.manage') }, async (req, reply) => {
    const d = await getD(req)
    await tx(async (c) => {
      await c.update('knowledge_documents', { id: d.id }, { deletedAt: new Date() })
      await c.q('DELETE FROM knowledge_chunks WHERE document_id = $1', [d.id])
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'knowledge.delete', target: { type: 'document', id: d.id } })
    })
    reply.ok({ deleted: true })
  })
  app.post('/knowledge/search', { preHandler: can('knowledge.view') }, async (req, reply) => {
    // scope=workspace (default): your documents only. scope=all: also the PoisonGuard platform guide.
    const b = parse(z.object({ query: z.string().trim().min(2).max(500), k: z.number().int().min(1).max(20).default(6), scope: z.enum(['workspace', 'all']).default('workspace') }), req.body)
    reply.ok(await hybridSearch({ workspaceId: req.ws.id, role: req.ws.membership.role, query: b.query, k: b.k, userId: req.ctx.user.id, includePlatform: b.scope === 'all' }))
  })
  app.get('/knowledge-retrievals', { preHandler: can('knowledge.manage') }, async (req, reply) => {
    reply.ok({ items: await db.q('SELECT r.id, r.query, r.mode, r.chunk_ids, r.created_at, u.name AS user FROM retrieval_logs r LEFT JOIN users u ON u.id = r.user_id WHERE r.workspace_id = $1 ORDER BY r.created_at DESC LIMIT 100', [req.ws.id]) })
  })

  // ── Ask PoisonGuard ──
  // Plan gate for the workspace assistant. The ask_poisonguard flag controls GENERATIVE answers only;
  // with the flag off (or no provider) answers are extractive quotes from cited sources.
  const assistantGate = async (req) => { await assertFeature(req.ws.id, 'aiAssistant') }
  app.post('/assistant/chat', { preHandler: can('assistant.use'), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    await assistantGate(req)
    const b = parse(z.object({ message: z.string().trim().min(2).max(2000), conversationId: z.string().optional(), findingId: z.string().optional() }), req.body)
    let finding = null
    if (b.findingId) {
      const f = await db.one('SELECT f.* FROM findings f JOIN scans s ON s.id = f.scan_id WHERE f.id = $1 AND s.workspace_id = $2', [b.findingId, req.ws.id])
      if (!f) throw notFound('Finding')
      finding = findingDto(f, await db.q('SELECT * FROM evidence WHERE finding_id = $1', [f.id]), null)
    }
    let conv = b.conversationId ? await db.one('SELECT * FROM ai_conversations WHERE id = $1 AND workspace_id = $2 AND user_id = $3', [b.conversationId, req.ws.id, req.ctx.user.id]) : null
    if (b.conversationId && !conv) throw notFound('Conversation')
    if (!conv) conv = await db.insert('ai_conversations', { id: newId('cnv'), workspaceId: req.ws.id, userId: req.ctx.user.id, title: b.message.slice(0, 80) })
    const history = b.conversationId ? await db.q('SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6', [conv.id]).then((r) => r.reverse()) : []
    const plan = (await db.one('SELECT plan_key FROM subscriptions WHERE workspace_id = $1', [req.ws.id]))?.planKey ?? 'free'
    const out = await answer({ workspaceId: req.ws.id, role: req.ws.membership.role, userId: req.ctx.user.id, message: b.message, finding, history,
      account: { workspaceName: req.ws.name, role: req.ws.membership.role, plan }, allowGenerative: await flagEnabled('ask_poisonguard', { workspaceId: req.ws.id }) })
    await db.insert('ai_messages', { id: newId('msg'), conversationId: conv.id, role: 'user', content: b.message })
    await db.insert('ai_messages', { id: newId('msg'), conversationId: conv.id, role: 'assistant', content: out.answer ?? '', citations: J(out.citations), provider: out.provider })
    await db.insert('usage_records', { id: newId('use'), workspaceId: req.ws.id, metric: 'ai_messages' })
    reply.ok({ conversationId: conv.id, ...out, disclaimer: 'The assistant explains; it never authorizes. Policy decisions are deterministic.' })
  })
  app.post('/assistant/explain-finding', { preHandler: can('assistant.use') }, async (req, reply) => {
    const b = parse(z.object({ findingId: z.string() }), req.body)
    const f = await db.one('SELECT f.*, s.chain_id FROM findings f JOIN scans s ON s.id = f.scan_id WHERE f.id = $1 AND s.workspace_id = $2', [b.findingId, req.ws.id])
    if (!f) throw notFound('Finding')
    const d = findingDto(f, await db.q('SELECT * FROM evidence WHERE finding_id = $1', [f.id]), f.chainId)
    const facts = d.evidence.filter((e) => e.kind === 'onchain_fact'), derived = d.evidence.filter((e) => e.kind === 'derived'), interp = d.evidence.filter((e) => e.kind === 'interpretation')
    // Deterministic explanation is always available; it does not depend on any AI provider.
    reply.ok({ findingId: d.id, ruleId: d.ruleId, method: d.method, severity: d.severity, confidence: d.confidence,
      explanation: { whatWasFound: d.summary, onChainFacts: facts.map((e) => `${e.label}: ${e.value}${e.txHash ? ` (tx ${e.txHash})` : ''}`), derivedMeasurements: derived.map((e) => `${e.label}: ${e.value}`), interpretation: interp.map((e) => e.value), limitations: d.limitations, recommendedAction: d.recommendation },
      provider: 'deterministic-template', note: 'For a conversational explanation use /assistant/chat with findingId.' })
  })
  app.get('/assistant/conversations', { preHandler: can('assistant.use') }, async (req, reply) => reply.ok({ items: await db.q('SELECT id, title, created_at FROM ai_conversations WHERE workspace_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50', [req.ws.id, req.ctx.user.id]) }))
  app.get('/assistant/conversations/:id', { preHandler: can('assistant.use') }, async (req, reply) => {
    const c = await db.one('SELECT * FROM ai_conversations WHERE id = $1 AND workspace_id = $2 AND user_id = $3', [req.params.id, req.ws.id, req.ctx.user.id])
    if (!c) throw notFound('Conversation')
    reply.ok({ ...c, messages: await db.q('SELECT role, content, citations, provider, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at', [c.id]) })
  })
}
