import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './index.js'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../migrations')

/** Applies migrations/*.sql in lexical order, each in its own transaction, recording them in schema_migrations. */
export async function runMigrations(log = console.log) {
  const c = await pool.connect()
  try {
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    await c.query('SELECT pg_advisory_lock(727001)')
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
    const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort()
    for (const f of files) {
      if (done.has(f)) continue
      const sql = await readFile(join(DIR, f), 'utf8')
      await c.query('BEGIN')
      try {
        await c.query(sql)
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f])
        await c.query('COMMIT')
        log(`applied ${f}`)
      } catch (e) { await c.query('ROLLBACK'); throw new Error(`Migration ${f} failed: ${e.message}`) }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(727001)').catch(() => {})
    c.release()
  }
}
