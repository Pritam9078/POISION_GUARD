import { z } from 'zod'
import { db } from '../../db/index.js'
import { parse, zAddress, zTxHash, zEmail, ADDR_RE, TX_RE } from '../../shared/validate.js'
import { resolveChain, CHAINS } from '../../shared/chains.js'
import { badRequest, notFound, unprocessable, AppError } from '../../shared/errors.js'
import { newId, newRef, secretToken } from '../../shared/ids.js'
import { sha256 } from '../../shared/crypto.js'
import { env } from '../../config/env.js'
import { svc } from '../../services/registry.js'
import { scanDto, approvalsFor, collectAddressData } from '../scanner/scan.service.js'
import { METHODOLOGY_VERSION, RULES } from '../scanner/rules.js'
import { checkRecipient } from '../recipients/check.service.js'
import { previewRevoke, verifyRevoke } from '../approvals/revoke.service.js'
import { audit } from '../audit/audit.service.js'

const zChain = z.union([z.coerce.number().int(), z.string()]).transform((v, ctx) => {
  const c = resolveChain(v)
  if (!c) { ctx.addIssue({ code: 'custom', message: 'Unsupported network' }); return z.NEVER }
  return c
})
const scanLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }
const reportLimit = { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }

/** Create a scan row and enqueue it. Shared by public, Guard and agent entry points. */
export async function createScan({ chain, input, workspaceId = null, requestedBy = null, agentId = null, parentScanId = null, ipHash = null }) {
  const v = String(input).trim()
  const subjectType = ADDR_RE.test(v) ? 'address' : TX_RE.test(v) ? 'transaction' : null
  if (!subjectType) throw badRequest('Enter a valid EVM address (0x + 40 hex) or transaction hash (0x + 64 hex). ENS names are not resolved yet.')
  if (!chain.capabilities.includes('scan')) throw unprocessable(`Scanning is not supported on ${chain.name}`)
  const id = newId('scn')
  await db.insert('scans', { id, workspaceId, requestedBy, agentId, subject: v.toLowerCase(), subjectType, chainId: chain.id, status: 'queued', ruleVersion: METHODOLOGY_VERSION, parentScanId, ipHash })
  await svc('jobs').enqueue('scan.run', { scanId: id }, { jobId: id })
  return { scanId: id, status: 'queued', subjectType, network: chain.key, chainId: chain.id, pollUrl: `/api/v1/scans/${id}` }
}

export default async function publicRoutes(app) {
  app.get('/health', async (req, reply) => reply.ok({ status: 'ok', service: 'poisonguard-api', time: new Date().toISOString() }))
  app.get('/health/ready', async (req, reply) => {
    try { await db.q('SELECT 1'); return reply.ok({ status: 'ready', database: 'ok' }) }
    catch { throw new AppError(503, 'NOT_READY', 'Database unavailable') }
  })

  app.get('/chains', async (req, reply) => {
    const rows = await db.q('SELECT * FROM chains ORDER BY id')
    const health = await db.q(`SELECT DISTINCT ON (integration_key) integration_key, status FROM provider_health_events WHERE integration_key LIKE 'rpc:%' ORDER BY integration_key, created_at DESC`)
    const items = (rows.length ? rows : CHAINS).map((c) => {
      const configured = !!env[c.rpcEnvVar]
      const h = health.find((x) => x.integrationKey === `rpc:${c.id}`)?.status
      return {
        key: c.key, name: c.name, chainId: c.id, symbol: c.symbol, explorer: c.explorerUrl.replace(/^https?:\/\//, ''), explorerUrl: c.explorerUrl,
        capabilities: configured && c.enabled !== false ? c.capabilities : [], configured, environment: c.environment || 'mainnet',
        status: !configured || c.enabled === false ? 'offline' : h === 'degraded' ? 'degraded' : h === 'down' ? 'offline' : 'operational',
        statusNote: !configured ? 'RPC not configured in this environment' : c.enabled === false ? 'Disabled by platform' : null,
      }
    })
    return reply.ok({ items })
  })

  // ── scans ──
  const scanBody = z.object({ network: zChain.optional(), chainId: zChain.optional(), input: z.string().max(100).optional(), subject: z.string().max(100).optional(), address: z.string().max(100).optional(), txHash: z.string().max(100).optional() })
  const startScan = async (req, reply, forced) => {
    const b = parse(scanBody, req.body)
    const chain = b.chainId || b.network || resolveChain(1)
    const input = b.input || b.subject || (forced === 'address' ? b.address : forced === 'transaction' ? b.txHash : b.address || b.txHash)
    if (!input) throw badRequest('input is required')
    if (forced === 'address' && !ADDR_RE.test(input.trim())) throw badRequest('address must be 0x + 40 hex')
    if (forced === 'transaction' && !TX_RE.test(input.trim())) throw badRequest('txHash must be 0x + 64 hex')
    return reply.ok(await createScan({ chain, input, ipHash: req.ctx.ipHash }), {}, 202)
  }
  app.post('/scans', scanLimit, (req, reply) => startScan(req, reply))
  app.post('/scans/address', scanLimit, (req, reply) => startScan(req, reply, 'address'))
  app.post('/scans/transaction', scanLimit, (req, reply) => startScan(req, reply, 'transaction'))

  app.get('/scans/:scanId', async (req, reply) => {
    const s = await db.one('SELECT id, workspace_id FROM scans WHERE id = $1', [req.params.scanId])
    if (!s || s.workspaceId) throw notFound('Scan') // workspace scans are never exposed on public routes
    return reply.ok(await scanDto(s.id))
  })
  app.post('/scans/:scanId/rerun', scanLimit, async (req, reply) => {
    const s = await db.one('SELECT * FROM scans WHERE id = $1 AND workspace_id IS NULL', [req.params.scanId])
    if (!s) throw notFound('Scan')
    return reply.ok(await createScan({ chain: resolveChain(s.chainId), input: s.subject, parentScanId: s.id, ipHash: req.ctx.ipHash }), {}, 202)
  })
  app.post('/scans/:scanId/share', scanLimit, async (req, reply) => {
    const b = parse(z.object({ ttlDays: z.coerce.number().int().min(1).max(90).default(30) }), req.body)
    const s = await db.one(`SELECT id FROM scans WHERE id = $1 AND workspace_id IS NULL AND status IN ('completed','partial')`, [req.params.scanId])
    if (!s) throw notFound('Completed public scan')
    const id = secretToken().slice(0, 32)
    const expiresAt = new Date(Date.now() + b.ttlDays * 86400_000)
    await db.insert('share_links', { id, scanId: s.id, expiresAt })
    return reply.ok({ shareId: id, url: `${env.FRONTEND_URL}/share/${id}`, expiresAt }, {}, 201)
  })
  app.get('/share/:shareId', async (req, reply) => {
    const l = await db.one('SELECT * FROM share_links WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()', [req.params.shareId])
    if (!l) throw notFound('Share link')
    const s = await scanDto(l.scanId, { includeApprovals: false })
    const counts = s.findings.reduce((m, f) => ((m[f.severity] = (m[f.severity] || 0) + 1), m), {})
    return reply.ok({
      shareId: l.id, expiresAt: l.expiresAt, scanId: s.id, subject: s.subject, subjectType: s.subjectType, network: s.network, status: s.status,
      riskLabel: s.riskLabel, riskScore: s.riskScore, summary: s.summary, pinnedBlock: s.pinnedBlock, completedAt: s.completedAt, methodologyVersion: s.methodologyVersion,
      findingsCount: s.findings.length, severityCounts: counts,
      findings: s.findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, ruleId: f.ruleId, evidenceLinks: f.evidence.filter((e) => e.explorerUrl).map((e) => e.explorerUrl) })),
      coverage: s.coverage,
      staleness: 'This is a snapshot at the pinned block. Results may be incomplete or out of date — run a new scan for current data.',
    })
  })

  // ── recipient check ──
  app.post('/recipients/check', scanLimit, async (req, reply) => {
    const b = parse(z.object({ chainId: zChain.optional(), network: zChain.optional(), address: zAddress, senderAddress: zAddress.optional(), expectedLabel: z.string().trim().max(120).optional(), contextTxHash: zTxHash.optional(), token: zAddress.optional(), amount: z.string().max(80).optional() }), req.body)
    const chain = b.chainId || b.network || resolveChain(1)
    return reply.ok(await checkRecipient({ chainId: chain.id, address: b.address, senderAddress: b.senderAddress, expectedLabel: b.expectedLabel, contextTxHash: b.contextTxHash, workspaceId: null }))
  })

  // ── approvals & revoke ──
  app.get('/approvals', scanLimit, async (req, reply) => {
    const qy = parse(z.object({ owner: zAddress, chainId: zChain.default(1), refresh: z.enum(['true', 'false']).optional() }), req.query)
    const fresh = await db.one(`SELECT max(updated_at) AS t FROM approval_records WHERE chain_id = $1 AND owner = $2`, [qy.chainId.id, qy.owner])
    let coverage = null
    if (qy.refresh === 'true' || !fresh?.t || Date.now() - new Date(fresh.t).getTime() > 5 * 60_000) {
      const data = await collectAddressData(qy.chainId.id, qy.owner)
      if (data.fatal) throw new AppError(503, data.fatal, data.coverage[0].note)
      coverage = data.coverage.filter((c) => c.source === 'Token approvals' || c.source.startsWith('EVM'))
      const { UNLIMITED_THRESHOLD } = await import('../scanner/rules.js')
      for (const a of data.approvals) {
        await db.insert('approval_records', { id: newId('apr'), chainId: qy.chainId.id, owner: qy.owner, token: a.token, spender: a.spender, allowance: a.allowance, isUnlimited: BigInt(a.allowance) >= UNLIMITED_THRESHOLD, spenderIsContract: a.spenderIsContract, lastVerifiedBlock: a.lastBlock },
          { onConflict: 'ON CONFLICT (chain_id, owner, token, spender) DO UPDATE SET allowance = EXCLUDED.allowance, is_unlimited = EXCLUDED.is_unlimited, spender_is_contract = EXCLUDED.spender_is_contract, last_verified_block = EXCLUDED.last_verified_block, updated_at = now()' })
      }
    }
    return reply.ok({ items: await approvalsFor(qy.chainId.id, qy.owner), coverage, unsupported: ['NFT (ERC-721/1155) approvals', 'Permit2 sub-allowances'] })
  })
  const revokeBody = z.object({ chainId: zChain, owner: zAddress, token: zAddress, spender: zAddress })
  app.post('/approvals/revoke-preview', scanLimit, async (req, reply) => {
    const b = parse(revokeBody, req.body)
    return reply.ok(await previewRevoke({ ...b, chainId: b.chainId.id }))
  })
  app.post('/approvals/verify', scanLimit, async (req, reply) => {
    const b = parse(revokeBody.extend({ txHash: zTxHash }), req.body)
    return reply.ok(await verifyRevoke({ ...b, chainId: b.chainId.id }))
  })

  // ── false-positive / incorrect-evidence reports ──
  const CATS = ['false_positive', 'incorrect_match', 'stale_approval', 'wrong_token_metadata', 'missing_evidence', 'missed_detection', 'provider_failure', 'data_issue', 'other']
  const feedback = async (req, reply) => {
    const b = parse(z.object({
      scanRef: z.string().trim().max(60).optional(), scanId: z.string().trim().max(60).optional(), findingId: z.string().trim().max(60).optional(),
      chainId: zChain.default(1), subject: z.string().trim().max(100).default(''), category: z.string().trim().toLowerCase().transform((v) => v.replace(/[\s-]+/g, '_')).pipe(z.enum(CATS)),
      explanation: z.string().trim().min(10, 'Please explain in at least 10 characters').max(4000), txLink: z.string().trim().max(300).optional(),
      contact: zEmail.optional().or(z.literal('').transform(() => undefined)), consent: z.boolean().optional(),
    }), req.body)
    const scanId = b.scanId || b.scanRef || null
    if (b.contact && !b.consent && b.consent !== undefined) throw badRequest('Consent is required to store your contact email')
    const dedupeHash = sha256([scanId, b.findingId, b.subject.toLowerCase(), b.category, b.explanation.toLowerCase().replace(/\s+/g, ' '), req.ctx.ipHash].join('|'))
    const dup = await db.one('SELECT reference, created_at FROM false_positive_reports WHERE dedupe_hash = $1', [dedupeHash])
    if (dup) return reply.ok({ id: dup.reference, reference: dup.reference, received: true, duplicate: true, timestamp: dup.createdAt })
    const reference = newRef('FP')
    const row = await db.insert('false_positive_reports', {
      id: newId('fpr'), reference, scanId, findingId: b.findingId ?? null, chainId: b.chainId.id, subject: b.subject, category: b.category,
      explanation: b.explanation, txLink: b.txLink ?? null, contactEmail: b.contact ?? null, consent: b.consent ?? !!b.contact, dedupeHash, ipHash: req.ctx.ipHash,
      contactPurgeAt: b.contact ? new Date(Date.now() + 180 * 86400_000) : null,
    })
    await audit(null, { actor: { type: 'anonymous', label: 'public reporter' }, action: 'report.submit', target: { type: 'false_positive_report', id: row.id }, metadata: { reference, category: b.category }, requestId: req.id })
    return reply.ok({ id: reference, reference, received: true, duplicate: false, status: 'submitted', timestamp: row.createdAt, note: 'Reports are reviewed by staff. A report never changes detection rules automatically.' }, {}, 201)
  }
  app.post('/feedback', reportLimit, feedback)
  app.post('/reports', reportLimit, feedback)

  app.post('/phishing-reports', reportLimit, async (req, reply) => {
    const b = parse(z.object({ url: z.string().trim().url().max(500), evidence: z.string().trim().min(5).max(4000), contact: zEmail.optional(), consent: z.literal(true, { error: 'Consent is required' }) }), req.body)
    const reference = newRef('PH')
    await db.insert('phishing_reports', { id: newId('phr'), reference, url: b.url, evidence: b.evidence, contactEmail: b.contact ?? null, consent: true })
    return reply.ok({ reference, received: true }, {}, 201)
  })

  // ── public platform help assistant: platform guide only, no workspace data, nothing stored per user ──
  app.post('/assistant/ask', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const b = parse(z.object({ question: z.string().trim().min(2).max(1000) }), req.body)
    const { answer } = await import('../knowledge/knowledge.service.js')
    const { flagEnabled } = await import('../flags/flags.js')
    const out = await answer({ workspaceId: null, role: 'public', userId: null, message: b.question, allowGenerative: await flagEnabled('platform_help_ai') })
    return reply.ok({ ...out, scope: 'PoisonGuard platform guide (public)', disclaimer: 'Help answers come from the published platform guide. The assistant cannot see or change your account.' })
  })

  // ── methodology & accuracy ──
  app.get('/methodology', async (req, reply) => {
    const versions = await db.q(`SELECT version, title, changes, effective_at AS released_at FROM methodology_versions WHERE status = 'published' ORDER BY created_at DESC`)
    const rules = Object.entries(RULES).map(([ruleId, r]) => ({ ruleId, version: METHODOLOGY_VERSION, ...r }))
    return reply.ok({
      currentVersion: METHODOLOGY_VERSION, versions, rules,
      chainSupport: CHAINS.map((c) => ({ key: c.key, chainId: c.id, capabilities: c.capabilities, configured: !!env[c.rpcEnvVar] })),
      limitations: [
        'Without an indexer, history is limited to the most recent ' + env.SCAN_LOG_BLOCK_RANGE + ' blocks via eth_getLogs.',
        'Native-asset transaction history requires an indexer.', 'NFT approvals and Permit2 sub-allowances are not analysed.',
        'ENS names are not resolved.', 'No threat-intelligence feed is integrated; detection is rule-based.',
      ],
    })
  })
  app.get('/methodology/evaluations', async (req, reply) => {
    const runs = await db.q('SELECT * FROM evaluation_runs WHERE published = true ORDER BY run_at DESC')
    if (!runs.length) return reply.ok({ status: 'evaluation_in_progress', message: 'No evaluation run has been published yet. PoisonGuard does not publish accuracy figures until a recorded evaluation exists.', items: [] })
    return reply.ok({ status: 'published', items: runs.map((r) => {
      const { truePositives: tp, falsePositives: fp, falseNegatives: fn, trueNegatives: tn } = r.results
      return { ...r, precision: tp + fp ? +(tp / (tp + fp)).toFixed(3) : null, recall: tp + fn ? +(tp / (tp + fn)).toFixed(3) : null,
        definitions: { precision: 'TP / (TP + FP)', recall: 'TP / (TP + FN)' }, totals: { tp, fp, tn, fn } }
    }) })
  })
  app.get('/content/:slug', async (req, reply) => {
    const c = await db.one(`SELECT slug, version, title, body, sources, reviewer, effective_at FROM content_pages WHERE slug = $1 AND status = 'published' ORDER BY version DESC LIMIT 1`, [req.params.slug])
    if (!c) throw notFound('Content')
    return reply.ok(c)
  })
}
