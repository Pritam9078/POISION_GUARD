import { db, pool } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { env } from '../../config/env.js'
import { CHAINS } from '../../shared/chains.js'
import { svc } from '../../services/registry.js'
import { tigergraphConfigured, ping } from '../../adapters/graph/tigergraph.js'
import { dodoConfigured } from '../../adapters/payments/dodo.js'

const record = async (key, status, latencyMs = null, error = null) => {
  await db.insert('provider_health_events', { id: newId('phe'), integrationKey: key, status, latencyMs, error })
  await db.q('UPDATE integrations SET status = $2, last_check_at = now(), last_error = $3 WHERE key = $1 AND enabled', [key, status, error])
}

/** Probes each integration. Never returns or logs credential values. */
export async function checkIntegrations() {
  const out = []
  for (const c of CHAINS) {
    const key = `rpc:${c.id}`
    const a = env[c.rpcEnvVar] ? svc('chains').adapter(c.id) : null
    if (!a) { await record(key, 'not_configured'); out.push({ key, status: 'not_configured' }); continue }
    const t = Date.now()
    try { await a.getBlockNumber(); const ms = Date.now() - t; const st = ms > 3000 ? 'degraded' : 'operational'; await record(key, st, ms); out.push({ key, status: st, latencyMs: ms }) }
    catch (e) { await record(key, 'down', Date.now() - t, e.message.slice(0, 200)); out.push({ key, status: 'down' }) }
  }
  await record('indexer:etherscan', svc('chains').indexer() ? 'operational' : 'not_configured')
  if (tigergraphConfigured()) { const t = Date.now(); try { await ping(); await record('graph:tigergraph', 'operational', Date.now() - t) } catch (e) { await record('graph:tigergraph', 'down', null, e.message.slice(0, 200)) } }
  else await record('graph:tigergraph', 'not_configured')
  await record('ai:llm', env.AI_PROVIDER === 'none' ? 'not_configured' : env.AI_PROVIDER === 'mock' ? 'degraded' : 'operational', null, env.AI_PROVIDER === 'mock' ? 'Mock provider — not for production' : null)
  await record('ai:embeddings', env.EMBEDDING_PROVIDER === 'none' ? 'not_configured' : env.EMBEDDING_PROVIDER === 'mock' ? 'degraded' : 'operational')
  await record('payments:dodo', dodoConfigured() ? 'operational' : 'not_configured')
  await record('email', svc('email').configured ? (env.EMAIL_PROVIDER === 'console' ? 'degraded' : 'operational') : 'not_configured', null, env.EMAIL_PROVIDER === 'console' ? 'Console provider: emails are logged, not delivered' : null)
  await record('queue:redis', env.JOB_MODE === 'queue' ? 'operational' : 'degraded', null, env.JOB_MODE === 'inline' ? 'Inline job mode (single process)' : null)
  await record('contract:proof-registry', env.PROOF_REGISTRY_ADDRESS ? 'operational' : 'not_configured')
  return { checked: out.length, items: out }
}

export async function platformHealth() {
  const t = Date.now(); let dbOk = true
  try { await db.q('SELECT 1') } catch { dbOk = false }
  const dbMs = Date.now() - t
  const [ints, failedScans, stuck, whFail] = await Promise.all([
    db.q('SELECT key, name, type, status, last_check_at, last_error FROM integrations ORDER BY type, key'),
    db.one(`SELECT count(*)::int AS n FROM scans WHERE status IN ('failed','timed_out') AND requested_at > now() - interval '24 hours'`),
    db.one(`SELECT count(*)::int AS n, min(requested_at) AS oldest FROM scans WHERE status IN ('queued','running') AND requested_at < now() - interval '10 minutes'`),
    db.one(`SELECT count(*)::int AS n FROM webhook_deliveries WHERE status IN ('failed','dead') AND created_at > now() - interval '24 hours'`),
  ])
  const lat = await db.q(`SELECT DISTINCT ON (integration_key) integration_key, latency_ms FROM provider_health_events ORDER BY integration_key, created_at DESC`)
  return [
    { component: 'API', status: 'operational', latency: '—', note: `uptime ${Math.round(process.uptime())}s` },
    { component: 'PostgreSQL', status: dbOk ? 'operational' : 'down', latency: `${dbMs} ms`, note: `pool total ${pool.totalCount}, idle ${pool.idleCount}` },
    { component: 'Scan workers', status: stuck.n ? 'degraded' : 'operational', latency: '—', note: `${failedScans.n} failed in 24h; ${stuck.n} queued/running > 10 min${stuck.oldest ? ` (oldest ${new Date(stuck.oldest).toISOString()})` : ''}` },
    { component: 'Webhook delivery', status: whFail.n ? 'degraded' : 'operational', latency: '—', note: `${whFail.n} failed deliveries in 24h` },
    ...ints.map((i) => ({ component: i.name, status: i.status, latency: lat.find((l) => l.integrationKey === i.key)?.latencyMs != null ? `${lat.find((l) => l.integrationKey === i.key).latencyMs} ms` : '—', note: i.lastError ?? '', lastCheck: i.lastCheckAt })),
  ]
}

/** Retention: purge optional contact emails and IP hashes after their windows; expire stale auth artifacts. */
export async function retentionSweep() {
  const days = Number((await db.one(`SELECT value FROM platform_settings WHERE key = 'retention.scan_ip_hash_days'`))?.value ?? 30)
  const r1 = await db.q(`UPDATE false_positive_reports SET contact_email = NULL WHERE contact_purge_at < now() AND contact_email IS NOT NULL RETURNING id`)
  const r2 = await db.q(`UPDATE scans SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND requested_at < now() - ($1 || ' days')::interval RETURNING id`, [String(days)])
  const expired = await db.q(`UPDATE knowledge_documents SET deleted_at = now() WHERE deleted_at IS NULL AND retention_days IS NOT NULL AND created_at + (retention_days || ' days')::interval < now() RETURNING id`)
  if (expired.length) await db.q('DELETE FROM knowledge_chunks WHERE document_id = ANY($1)', [expired.map((d) => d.id)])
  await db.q(`DELETE FROM wallet_challenges WHERE expires_at < now() - interval '1 day'`)
  await db.q(`DELETE FROM sessions WHERE expires_at < now() - interval '30 days'`)
  await db.q(`UPDATE share_links SET revoked_at = now() WHERE expires_at < now() AND revoked_at IS NULL`)
  return { contactsPurged: r1.length, ipHashesPurged: r2.length, knowledgeDocsExpired: expired.length }
}
