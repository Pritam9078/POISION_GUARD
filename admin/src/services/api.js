const BASE = import.meta.env.VITE_API_BASE || '/api/v1'
export class ApiError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status } }
export async function api(path, { method = 'GET', body } = {}) {
  let res
  try { res = await fetch(BASE + path, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }) }
  catch { throw new ApiError('NETWORK', 'Cannot reach the PoisonGuard API.', 0) }
  let json = null
  try { json = await res.json() } catch { /* non-JSON */ }
  if (!res.ok || !json?.success) throw new ApiError(json?.error?.code || 'HTTP_' + res.status, json?.error?.message || 'Request failed (' + res.status + ').', res.status)
  return json.data
}
export const isAddress = (v) => /^0x[a-fA-F0-9]{40}$/.test(v)
export const isTxHash = (v) => /^0x[a-fA-F0-9]{64}$/.test(v)
export const NETWORKS = [{ id: 1, name: 'Ethereum' }, { id: 8453, name: 'Base' }, { id: 42161, name: 'Arbitrum' }, { id: 10, name: 'Optimism' }, { id: 137, name: 'Polygon' }]
