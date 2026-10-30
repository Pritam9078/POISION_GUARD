import pg from 'pg'
import { env } from '../config/env.js'

// int8 -> string (block numbers/amounts never lose precision); numeric -> string
pg.types.setTypeParser(20, (v) => v)

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  // Prevent unhandled error crashing process when cloud PostgreSQL terminates idle TLS connections
  console.warn('[pg:pool] Idle database client error:', err?.message || err)
})

const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
export const toCamel = (row) => {
  if (!row) return row
  const o = {}
  for (const k of Object.keys(row)) o[camel(k)] = row[k]
  return o
}

/** Marks a value to be stored as jsonb (arrays would otherwise become pg arrays). */
export class Json { constructor(v) { this.v = v } }
export const J = (v) => new Json(v)

function prep(v) {
  if (v instanceof Json) return JSON.stringify(v.v)
  if (typeof v === 'bigint') return v.toString()
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v)
  return v
}

const isTransientDbError = (err) => {
  const code = err?.code || ''
  const msg = err?.message || ''
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === '57P01' || // admin_shutdown
    code === '08006' || // connection_failure
    code === '08001' || // unable_to_establish_sqlconnection
    code === '08004' || // server_rejected_connection
    msg.includes('Connection terminated unexpectedly')
  )
}

function client(c) {
  const q = async (text, params = [], retries = 3) => {
    let lastErr
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await c.query(text, params.map(prep))
        return r.rows.map(toCamel)
      } catch (err) {
        lastErr = err
        if (attempt < retries && isTransientDbError(err)) {
          await new Promise((res) => setTimeout(res, 200 * (attempt + 1)))
          continue
        }
        throw err
      }
    }
    throw lastErr
  }
  return {
    q,
    one: async (text, params) => (await q(text, params))[0] ?? null,
    async insert(table, obj, { returning = '*', onConflict = '' } = {}) {
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined)
      const cols = keys.map(snake).join(', ')
      const ph = keys.map((_, i) => `$${i + 1}`).join(', ')
      const rows = await q(`INSERT INTO ${table} (${cols}) VALUES (${ph}) ${onConflict} RETURNING ${returning}`, keys.map((k) => obj[k]))
      return rows[0] ?? null
    },
    /** update(table, where, patch) — where is an object of equality conditions. */
    async update(table, where, patch) {
      const pk = Object.keys(patch).filter((k) => patch[k] !== undefined)
      if (!pk.length) return null
      const wk = Object.keys(where)
      const sets = pk.map((k, i) => `${snake(k)} = $${i + 1}`)
      if (table !== 'audit_events' && !('updatedAt' in patch) && UPDATED_AT.has(table)) sets.push('updated_at = now()')
      const conds = wk.map((k, i) => `${snake(k)} = $${pk.length + i + 1}`).join(' AND ')
      const rows = await q(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${conds} RETURNING *`, [...pk.map((k) => patch[k]), ...wk.map((k) => where[k])])
      return rows[0] ?? null
    },
  }
}

const UPDATED_AT = new Set(['users', 'workspaces', 'memberships', 'approval_records', 'false_positive_reports', 'watched_wallets',
  'trusted_recipients', 'agents', 'policies', 'spend_intents', 'execution_attempts', 'security_incidents', 'graph_sync_jobs',
  'knowledge_documents', 'subscriptions', 'integrations', 'staff_users', 'feature_flags', 'platform_settings', 'chains', 'detection_rules'])

export const db = client(pool)

/** Run fn inside a transaction; fn receives a client with the same helpers. */
export async function tx(fn, maxRetries = 2) {
  let lastErr
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let c
    try {
      c = await pool.connect()
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries && isTransientDbError(err)) {
        await new Promise((res) => setTimeout(res, 250 * (attempt + 1)))
        continue
      }
      throw err
    }
    try {
      await c.query('BEGIN')
      const out = await fn(client(c))
      await c.query('COMMIT')
      return out
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      c.release()
    }
  }
  throw lastErr
}
