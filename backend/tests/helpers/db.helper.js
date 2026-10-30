import pg from 'pg'
import { TEST_RUN_PREFIX } from '../fixtures/identities.fixture.js'

const { Pool } = pg

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/poisonguard_test'

// Assert safety: MUST NOT run against production database
function assertTestDatabase(url) {
  if (!url.includes('test') && !url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error(`SAFETY VIOLATION: Test suite attempted to connect to non-test database: ${url}`)
  }
}

assertTestDatabase(TEST_DB_URL)

export const testPool = new Pool({
  connectionString: TEST_DB_URL,
  max: 10,
  idleTimeoutMillis: 10000,
})

export async function query(sql, params = []) {
  return testPool.query(sql, params)
}

export async function getClient() {
  return testPool.connect()
}

export async function cleanTestRunData(prefix = TEST_RUN_PREFIX) {
  const client = await testPool.connect()
  try {
    await client.query('BEGIN')
    const pattern = `%${prefix}%`
    await client.query(`DELETE FROM audit_events WHERE actor_label LIKE $1 OR actor_label LIKE '%@poison-guard.test'`, [pattern])
    await client.query(`DELETE FROM security_incidents WHERE title LIKE $1`, [pattern])
    await client.query(`DELETE FROM spend_intents WHERE purpose LIKE $1`, [pattern])
    await client.query(`DELETE FROM policies WHERE name LIKE $1`, [pattern])
    await client.query(`DELETE FROM agents WHERE name LIKE $1`, [pattern])
    await client.query(`DELETE FROM trusted_recipients WHERE label LIKE $1`, [pattern])
    await client.query(`DELETE FROM watched_wallets WHERE label LIKE $1`, [pattern])
    await client.query(`DELETE FROM workspaces WHERE name LIKE $1`, [pattern])
    await client.query(`DELETE FROM staff_users WHERE email LIKE '%@poison-guard.test' OR email LIKE $1`, [pattern])
    await client.query(`DELETE FROM users WHERE email LIKE '%@poison-guard.test' OR email LIKE $1`, [pattern])
    await client.query('COMMIT')
    return { cleaned: true, prefix }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
