import { z } from 'zod'
import { db } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { notFound } from '../../shared/errors.js'
import { resolveChain, chainById } from '../../shared/chains.js'
import { createScan } from '../public/public.routes.js'
import { scanDto } from './scan.service.js'
import { assertWithinLimit } from '../billing/entitlements.js'
import { pageOf, pageMeta } from '../../shared/http.js'
import { newId, secretToken } from '../../shared/ids.js'
import { env } from '../../config/env.js'
import { audit } from '../audit/audit.service.js'

export default async function (app) {
  app.get('/scans', { preHandler: can('scans.view') }, async (req, reply) => {
    const p = pageOf(req)
    const q = req.query, params = [req.ws.id]; let w = 'workspace_id = $1'
    if (q.status) { params.push(q.status); w += ` AND status = $${params.length}` }
    if (q.subject) { params.push(String(q.subject).toLowerCase()); w += ` AND subject = $${params.length}` }
    if (q.chainId) { params.push(Number(q.chainId)); w += ` AND chain_id = $${params.length}` }
    if (q.riskLabel) { params.push(q.riskLabel); w += ` AND risk_label = $${params.length}` }
    if (q.ruleId) { params.push(q.ruleId); w += ` AND EXISTS (SELECT 1 FROM findings f WHERE f.scan_id = scans.id AND f.rule_id = $${params.length})` }
    if (q.severity) { params.push(q.severity); w += ` AND EXISTS (SELECT 1 FROM findings f WHERE f.scan_id = scans.id AND f.severity = $${params.length})` }
    const [rows, total] = await Promise.all([
      db.q(`SELECT s.*, (SELECT count(*)::int FROM findings f WHERE f.scan_id = s.id) AS findings_count FROM scans s WHERE ${w} ORDER BY requested_at DESC LIMIT ${p.limit} OFFSET ${p.offset}`, params),
      db.one(`SELECT count(*) FROM scans WHERE ${w}`, params),
    ])
    reply.ok({ items: rows.map((s) => ({ id: s.id, subject: s.subject, subjectType: s.subjectType, network: chainById(s.chainId)?.key, chainId: s.chainId, block: s.pinnedBlock, status: s.status, riskLabel: s.riskLabel, riskScore: s.riskScore, findingsCount: s.findingsCount, requestedAt: s.requestedAt, completedAt: s.completedAt, triggeredBy: s.requestedBy ? 'member' : s.agentId ? 'agent' : 'monitoring' })) }, pageMeta(p, total.count))
  })

  app.post('/scans', { preHandler: can('scans.run') }, async (req, reply) => {
    const b = parse(z.object({ chainId: z.union([z.number(), z.string()]).default(1), input: z.string().max(100) }), req.body)
    const chain = resolveChain(b.chainId)
    if (!chain) throw notFound('Network')
    await assertWithinLimit(req.ws.id, 'monthlyScans')
    const out = await createScan({ chain, input: b.input, workspaceId: req.ws.id, requestedBy: req.ctx.user.id })
    await db.insert('usage_records', { id: newId('use'), workspaceId: req.ws.id, metric: 'scans' })
    reply.ok({ ...out, pollUrl: `/api/v1/workspaces/${req.ws.id}/scans/${out.scanId}` }, {}, 202)
  })

  const getScan = async (req, id = req.params.scanId) => {
    const s = await db.one('SELECT id FROM scans WHERE id = $1 AND workspace_id = $2', [id, req.ws.id])
    if (!s) throw notFound('Scan')
    return scanDto(s.id)
  }
  app.get('/scans/:scanId', { preHandler: can('scans.view') }, async (req, reply) => reply.ok(await getScan(req)))

  // Re-run never mutates the original — it creates a new scan pointing at its parent.
  app.post('/scans/:scanId/rerun', { preHandler: can('scans.run') }, async (req, reply) => {
    const s = await getScan(req)
    await assertWithinLimit(req.ws.id, 'monthlyScans')
    reply.ok(await createScan({ chain: chainById(s.chainId), input: s.subject, workspaceId: req.ws.id, requestedBy: req.ctx.user.id, parentScanId: s.id }), {}, 202)
  })

  app.get('/scans/compare', { preHandler: can('scans.view') }, async (req, reply) => {
    const q = parse(z.object({ a: z.string(), b: z.string() }), req.query)
    const [A, B] = await Promise.all([getScan(req, q.a), getScan(req, q.b)])
    const key = (f) => `${f.ruleId}:${f.relatedAddress}`
    const ka = new Set(A.findings.map(key)), kb = new Set(B.findings.map(key))
    reply.ok({ a: { id: A.id, block: A.pinnedBlock, riskLabel: A.riskLabel }, b: { id: B.id, block: B.pinnedBlock, riskLabel: B.riskLabel },
      added: B.findings.filter((f) => !ka.has(key(f))), resolved: A.findings.filter((f) => !kb.has(key(f))), unchanged: B.findings.filter((f) => ka.has(key(f))).map((f) => f.id) })
  })

  app.get('/scans/:scanId/export', { preHandler: can('scans.view') }, async (req, reply) => {
    const s = await getScan(req)
    await audit(null, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'scan.export', target: { type: 'scan', id: s.id } })
    reply.header('Content-Disposition', `attachment; filename="${s.id}.json"`)
    reply.ok({ exportedAt: new Date().toISOString(), scan: s })
  })

  app.post('/scans/:scanId/share', { preHandler: can('scans.run') }, async (req, reply) => {
    const s = await getScan(req)
    const id = secretToken().slice(0, 32)
    const expiresAt = new Date(Date.now() + 14 * 86400_000)
    await db.insert('share_links', { id, scanId: s.id, expiresAt })
    await audit(null, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'scan.share', target: { type: 'scan', id: s.id }, metadata: { shareId: id.slice(0, 6) + '…' } })
    reply.ok({ shareId: id, url: `${env.FRONTEND_URL}/share/${id}`, expiresAt, note: 'Share cards never include workspace names, members or trusted-recipient labels.' }, {}, 201)
  })
  // Bounded graph view: only for addresses this workspace watches (tenant boundary on graph traversal).
  app.get('/graph/neighbors', { preHandler: can('scans.view') }, async (req, reply) => {
    const q = parse(z.object({ walletId: z.string(), limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query)
    const w = await db.one(`SELECT chain_id, address FROM watched_wallets WHERE id = $1 AND workspace_id = $2 AND status <> 'removed'`, [q.walletId, req.ws.id])
    if (!w) throw notFound('Watched wallet')
    const { neighbors } = await import('../graph/graph.service.js')
    reply.ok(await neighbors({ chainId: w.chainId, address: w.address, limit: q.limit }))
  })

  app.delete('/shares/:shareId', { preHandler: can('scans.run') }, async (req, reply) => {
    const r = await db.one(`UPDATE share_links l SET revoked_at = now() FROM scans s WHERE l.id = $1 AND s.id = l.scan_id AND s.workspace_id = $2 AND l.revoked_at IS NULL RETURNING l.id`, [req.params.shareId, req.ws.id])
    if (!r) throw notFound('Share link')
    reply.ok({ revoked: true })
  })
}
