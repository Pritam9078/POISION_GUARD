import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { testPool } from '../../helpers/db.helper.js'

describe('Integration: PostgreSQL Database', () => {
  test('connects and executes basic query on test database', async () => {
    const res = await testPool.query('SELECT 1 AS num, current_database() AS dbname')
    assert.equal(res.rows[0].num, 1)
    assert.ok(res.rows[0].dbname.includes('test') || res.rows[0].dbname === 'poisonguard')
  })

  test('handles transaction rollback cleanly on error', async () => {
    const client = await testPool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT 1')
      // Simulate error
      await assert.rejects(async () => {
        await client.query('SELECT * FROM non_existent_table_for_rollback_test')
      })
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})

