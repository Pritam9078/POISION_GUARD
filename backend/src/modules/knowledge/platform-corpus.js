/**
 * Platform knowledge corpus — what the assistant "knows" about PoisonGuard.
 *  - knowledge/platform/*.md : hand-written product guide (reviewed with each release)
 *  - generated reference     : built from the code's own constants, so it cannot drift from behaviour
 * Ingested on boot as public, platform-scoped documents. Changed files create a new version; unchanged files are skipped.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, tx } from '../../db/index.js'
import { sha256 } from '../../shared/crypto.js'
import { RULES, METHODOLOGY_VERSION, UNLIMITED_THRESHOLD } from '../scanner/rules.js'
import { CHAINS, CANONICAL_TOKENS, KNOWN_SPENDERS } from '../../shared/chains.js'
import { WORKSPACE_ROLES, capsForRole, CAPABILITIES } from '../../shared/permissions.js'
import { PLANS } from '../../shared/plans.js'
import { MACHINES } from '../../shared/states.js'
import { createDocument, ingestDocument } from './knowledge.service.js'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../knowledge/platform')
export const CORPUS_VERSION = `platform-${METHODOLOGY_VERSION}`

const CAP_LABEL = {
  'workspace.view': 'view the workspace', 'workspace.settings': 'change workspace settings', 'workspace.delete': 'request workspace deletion',
  'members.view': 'see members', 'members.manage': 'invite, remove and change roles of members', 'wallets.view': 'see watched wallets', 'wallets.manage': 'add, edit and remove watched wallets',
  'recipients.view': 'see trusted recipients', 'recipients.manage': 'add and edit trusted recipients', 'recipients.verify': 'verify trusted recipients added by others',
  'scans.view': 'see scans', 'scans.run': 'run scans', 'agents.view': 'see agents', 'agents.manage': 'register, activate and configure agents and their credentials', 'agents.freeze': 'freeze agents',
  'intents.view': 'see spend intents', 'intents.create': 'create and edit spend intents', 'intents.approve': 'approve or reject spend intents', 'intents.execute': 'prepare and submit approved spend intents',
  'policies.view': 'see policies and use the simulator', 'policies.edit': 'create and edit policies', 'policies.activate': 'activate, roll back and disable policies',
  'audit.view': 'see the full audit log and verify it', 'audit.view_own': 'see your own audit events', 'proofs.view': 'see proofs', 'proofs.manage': 'create checkpoints and anchor or verify proofs',
  'events.view': 'see security events', 'events.manage': 'handle security events', 'knowledge.view': 'search the knowledge base', 'knowledge.manage': 'add and remove knowledge base documents',
  'assistant.use': 'use the assistant', 'billing.view': 'see billing', 'billing.manage': 'change plan and pay', 'apikeys.manage': 'manage API keys', 'webhooks.manage': 'manage webhooks', 'notifications.view': 'see notifications',
}
export const capLabel = (c) => CAP_LABEL[c] || c

const fmtLimit = (v) => (v == null ? 'unlimited (contract)' : typeof v === 'boolean' ? (v ? 'included' : 'not included') : v.toLocaleString('en-US'))

/** Reference text generated from code constants. */
export function generatedReference() {
  const s = []
  s.push(`# Detection rules reference (methodology ${METHODOLOGY_VERSION})`)
  for (const [id, r] of Object.entries(RULES)) s.push(`## ${id} — ${r.name}\nCategory: ${r.category}. Default severity: ${r.defaultSeverity}. ${r.description} Thresholds: ${JSON.stringify(r.thresholds)}. Known false positives: ${r.knownFalsePositives}`)
  s.push(`## What counts as an unlimited allowance?\nAn allowance of ${UNLIMITED_THRESHOLD.toString()} base units (2^128) or more is treated as effectively unlimited.`)
  s.push('# Supported networks reference')
  for (const c of CHAINS) s.push(`## ${c.name} (chain id ${c.id})\nKey: ${c.key}. Native asset ${c.symbol}. Explorer ${c.explorerUrl}. Capabilities: ${c.capabilities.join(', ')}. Confirmations required before verification: ${c.confirmations}.${c.environment === 'testnet' ? ' This is a testnet.' : ''} Canonical tokens: ${CANONICAL_TOKENS.filter((t) => t.chainId === c.id).map((t) => `${t.symbol} ${t.address} (${t.decimals} decimals)`).join('; ') || 'none listed'}.`)
  s.push(`## Which spender contracts does PoisonGuard recognize?\nRecognized labels (identification only, not a safety guarantee): ${Object.entries(KNOWN_SPENDERS).map(([a, n]) => `${n} ${a}`).join('; ')}.`)
  s.push('# Roles and permissions reference')
  for (const r of WORKSPACE_ROLES) s.push(`## What can the ${r[0].toUpperCase() + r.slice(1)} role do?\nThe ${r} role can: ${capsForRole(r).map(capLabel).join('; ')}. It cannot: ${CAPABILITIES.filter((c) => !capsForRole(r).includes(c)).map(capLabel).join('; ') || 'nothing is excluded'}.`)
  s.push('# Plans and limits reference')
  for (const p of PLANS) s.push(`## ${p.name} plan limits\nPrice: ${p.priceMonthlyCents ? `$${(p.priceMonthlyCents / 100).toFixed(2)} per month` : p.key === 'enterprise' ? 'contact sales' : 'free'}. Scans per month: ${fmtLimit(p.entitlements.monthlyScans)}. Watched wallets: ${fmtLimit(p.entitlements.watchedWallets)}. Seats: ${fmtLimit(p.entitlements.seats)}. Agents: ${fmtLimit(p.entitlements.agents)}. Spend intents per month: ${fmtLimit(p.entitlements.monthlySpendIntents)}. Webhooks: ${fmtLimit(p.entitlements.webhooks)}. API access: ${fmtLimit(p.entitlements.apiAccess)}. Assistant: ${fmtLimit(p.entitlements.aiAssistant)}. Graph analytics: ${fmtLimit(p.entitlements.graphAnalytics)}. Audit retention: ${p.entitlements.auditRetentionDays} days.`)
  s.push('# Status lifecycle reference')
  const names = { scan: 'Scan', intent: 'Spend intent', revocation: 'Token approval revocation', incident: 'Security event', report: 'False-positive report' }
  for (const [m, states] of Object.entries(MACHINES)) s.push(`## ${names[m]} status transitions\n${Object.entries(states).map(([from, to]) => `${from} → ${to.length ? to.join(' or ') : '(final)'}`).join('. ')}.`)
  return s.join('\n\n')
}

export async function loadPlatformCorpus() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.md')).sort()
  const docs = []
  for (const f of files) {
    const content = await readFile(join(DIR, f), 'utf8')
    docs.push({ slug: f.replace(/\.md$/, ''), title: content.match(/^#\s+(.*)/m)?.[1] ?? f, content })
  }
  docs.push({ slug: '99-generated-reference', title: 'PoisonGuard reference (generated from code)', content: generatedReference() })
  return docs
}

/** Idempotent, versioned ingestion. Returns counts. */
export async function ingestPlatformKnowledge({ log = () => {} } = {}) {
  const corpus = await loadPlatformCorpus()
  let created = 0, updated = 0, unchanged = 0
  const keep = new Set(corpus.map((d) => d.slug))
  for (const d of corpus) {
    const hash = sha256(d.content)
    const cur = await db.one(`SELECT id, content_hash, version FROM knowledge_documents WHERE workspace_id IS NULL AND slug = $1 AND deleted_at IS NULL`, [d.slug])
    if (cur?.contentHash === hash) { unchanged++; continue }
    const doc = await tx(async (c) => {
      if (cur) { await c.q('UPDATE knowledge_documents SET deleted_at = now() WHERE id = $1', [cur.id]); await c.q('DELETE FROM knowledge_chunks WHERE document_id = $1', [cur.id]) }
      const r = await createDocument(c, { workspaceId: null, title: d.title, category: 'platform', source: `PoisonGuard platform guide (${CORPUS_VERSION})`, accessScope: 'public', tags: ['platform'], content: d.content, createdById: null })
      await c.q('UPDATE knowledge_documents SET slug = $1, version = $2 WHERE id = $3', [d.slug, (cur?.version ?? 0) + 1, r.doc.id])
      return r.doc
    })
    await ingestDocument({ documentId: doc.id }).catch((e) => log(`embedding failed for ${d.slug}: ${e.message}`))
    cur ? updated++ : created++
  }
  // Retire platform docs whose source file was removed.
  const stale = await db.q(`UPDATE knowledge_documents SET deleted_at = now() WHERE workspace_id IS NULL AND slug IS NOT NULL AND deleted_at IS NULL AND NOT (slug = ANY($1)) RETURNING id`, [[...keep]])
  if (stale.length) await db.q('DELETE FROM knowledge_chunks WHERE document_id = ANY($1)', [stale.map((s) => s.id)])
  const r = { created, updated, unchanged, retired: stale.length, version: CORPUS_VERSION }
  log(`platform knowledge: ${JSON.stringify(r)}`)
  return r
}
