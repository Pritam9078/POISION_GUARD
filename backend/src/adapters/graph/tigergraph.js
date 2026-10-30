import { env } from '../../config/env.js'

/**
 * TigerGraph REST++ adapter (upsert + installed-query calls). UNTESTED against a live cluster in this repo —
 * see docs/TIGERGRAPH.md for schema DDL and the verification checklist.
 */
let cachedToken = null

export const tigergraphConfigured = () => !!(env.TIGERGRAPH_HOST && (env.TIGERGRAPH_TOKEN || env.TIGERGRAPH_SECRET))
const host = () => env.TIGERGRAPH_HOST.replace(/\/$/, '')
const base = () => `${host()}/restpp`

async function getAuthToken() {
  if (env.TIGERGRAPH_TOKEN) return env.TIGERGRAPH_TOKEN
  if (cachedToken) return cachedToken
  if (!env.TIGERGRAPH_SECRET) return null
  try {
    const r = await fetch(`${host()}/gsql/v1/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TIGERGRAPH_SECRET, lifetime: '2592000' })
    })
    const j = await r.json().catch(() => ({}))
    if (j.token) {
      cachedToken = j.token
      return cachedToken
    }
  } catch (e) {
    // fallback to null
  }
  return null
}

async function call(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const token = await getAuthToken()
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const r = await fetch(`${base()}${path}`, { method, signal: ctl.signal, headers, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(`TigerGraph ${r.status}: ${j.message || 'error'}`)
    return j
  } finally { clearTimeout(t) }
}
/** Upsert is idempotent: vertices keyed by id, edges by (from, to, type) with discriminator attrs. */
export const upsert = (payload) => call(`/graph/${encodeURIComponent(env.TIGERGRAPH_GRAPH_NAME)}`, { method: 'POST', body: payload })
export const runQuery = (name, params) => call(`/query/${encodeURIComponent(env.TIGERGRAPH_GRAPH_NAME)}/${encodeURIComponent(name)}?${new URLSearchParams(params)}`, { timeoutMs: 15000 })
export const ping = () => call('/echo', { timeoutMs: 15000 })
