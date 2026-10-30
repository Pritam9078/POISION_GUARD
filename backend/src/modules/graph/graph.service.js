import { db } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { tigergraphConfigured, upsert, runQuery } from '../../adapters/graph/tigergraph.js'
import { flagEnabled } from '../flags/flags.js'

const vid = (chainId, a) => `${chainId}:${a}`

/** Mirror a scan's observed relationships into TigerGraph. PostgreSQL stays the system of record. */
export async function syncScan({ scanId }) {
  const job = await db.insert('graph_sync_jobs', { id: newId('gsj'), scanId }, { onConflict: 'ON CONFLICT (scan_id) DO UPDATE SET attempts = graph_sync_jobs.attempts + 1, updated_at = now()' })
  if (job.status === 'synced') return { skipped: 'already synced' }
  if (!tigergraphConfigured() || !(await flagEnabled('tigergraph_sync'))) { await db.update('graph_sync_jobs', { id: job.id }, { status: 'skipped', error: 'TigerGraph not configured or tigergraph_sync flag disabled' }); return { skipped: true } }
  const s = await db.one('SELECT * FROM scans WHERE id = $1', [scanId])
  const subject = s.subjectType === 'address' ? s.subject : null
  const transfers = subject ? await db.q('SELECT * FROM transfers WHERE chain_id = $1 AND (from_address = $2 OR to_address = $2) LIMIT 500', [s.chainId, subject]) : []
  const findings = await db.q('SELECT id, rule_id, severity, subject_address, related_address FROM findings WHERE scan_id = $1', [scanId])
  const V = { Wallet: {}, Token: {}, Finding: {} }, E = { Wallet: {} }
  const wallet = (a) => (V.Wallet[vid(s.chainId, a)] = { chain_id: { value: s.chainId }, address: { value: a } })
  const edge = (fromType, from, type, toType, to, attrs) => { ((E[fromType] ??= {})[from] ??= {})[type] ??= {}; (E[fromType][from][type][toType] ??= {})[to] = attrs }
  for (const t of transfers) {
    wallet(t.fromAddress); wallet(t.toAddress)
    if (t.token) V.Token[vid(s.chainId, t.token)] = { chain_id: { value: s.chainId }, address: { value: t.token } }
    edge('Wallet', vid(s.chainId, t.fromAddress), 'TRANSFERRED', 'Wallet', vid(s.chainId, t.toAddress), { tx_hash: { value: t.txHash }, token: { value: t.token ?? 'native' }, value: { value: t.value }, block: { value: Number(t.blockNumber) } })
  }
  for (const f of findings) {
    V.Finding[f.id] = { rule_id: { value: f.ruleId }, severity: { value: f.severity } }
    if (f.subjectAddress) { wallet(f.subjectAddress); edge('Wallet', vid(s.chainId, f.subjectAddress), 'HAS_FINDING', 'Finding', f.id, {}) }
    if (f.relatedAddress) { wallet(f.relatedAddress); edge('Wallet', vid(s.chainId, f.relatedAddress), 'FLAGGED_IN', 'Finding', f.id, {}) }
  }
  try {
    const r = await upsert({ vertices: V, edges: E })
    const counts = r.results?.[0] || {}
    await db.update('graph_sync_jobs', { id: job.id }, { status: 'synced', vertices: counts.accepted_vertices ?? Object.values(V).reduce((n, o) => n + Object.keys(o).length, 0), edges: counts.accepted_edges ?? transfers.length + findings.length, error: null })
    return { synced: true }
  } catch (e) {
    await db.update('graph_sync_jobs', { id: job.id }, { status: 'failed', error: e.message.slice(0, 300) })
    throw e
  }
}

/**
 * Bounded relationship view for an address the workspace is authorized for. Uses TigerGraph when configured
 * (installed query `pg_neighbors`), else PostgreSQL. Proximity is context, never proof of maliciousness.
 */
export async function neighbors({ chainId, address, limit = 50 }) {
  if (tigergraphConfigured() && (await flagEnabled('tigergraph_sync'))) {
    try { const r = await runQuery('pg_neighbors', { wallet: vid(chainId, address), max_results: limit }); return { source: 'tigergraph', ...r.results?.[0] } } catch (e) { /* fall back */ }
  }
  const rows = await db.q(`SELECT CASE WHEN from_address = $2 THEN to_address ELSE from_address END AS counterparty,
      count(*)::int AS transfers, count(*) FILTER (WHERE value = '0')::int AS zero_value, max(block_number) AS last_block,
      bool_or(from_address = $2) AS outgoing, bool_or(to_address = $2) AS incoming
    FROM transfers WHERE chain_id = $1 AND (from_address = $2 OR to_address = $2) GROUP BY 1 ORDER BY transfers DESC LIMIT $3`, [chainId, address, limit])
  const flagged = rows.length ? await db.q(`SELECT related_address, array_agg(DISTINCT rule_id) AS rules FROM findings f JOIN scans s ON s.id = f.scan_id WHERE s.chain_id = $1 AND related_address = ANY($2) AND review_status <> 'false_positive' GROUP BY 1`, [chainId, rows.map((r) => r.counterparty)]) : []
  return { source: 'postgres', depth: 1, address, items: rows.map((r) => ({ ...r, flaggedRules: flagged.find((f) => f.relatedAddress === r.counterparty)?.rules ?? [] })), note: 'Derived from transfers observed by PoisonGuard scans only. Graph proximity does not prove malicious behavior.' }
}
