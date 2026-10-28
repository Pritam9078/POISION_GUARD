import { parse, zPage } from './validate.js'
export function pageOf(req) { const p = parse(zPage, req.query); return { ...p, limit: p.pageSize, offset: (p.page - 1) * p.pageSize } }
export const pageMeta = (p, total) => ({ page: p.page, pageSize: p.pageSize, total: Number(total) })
/** Builds "AND col = $n" filters from an allowlist of query params → columns. */
export function filters(query, map, startIndex = 1) {
  const clauses = [], params = []
  for (const [key, col] of Object.entries(map)) {
    const v = query[key]
    if (v === undefined || v === '') continue
    params.push(col.cast ? col.cast(v) : v)
    clauses.push(`${col.col || col} ${col.op || '='} $${startIndex + params.length - 1}`)
  }
  return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', params }
}
