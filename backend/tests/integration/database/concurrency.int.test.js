import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getClient, testPool } from '../../helpers/db.helper.js'

describe('Database: Integrity, Referential Constraints & Concurrency Suite', () => {
  let dbClient

  before(async () => {
    dbClient = await getClient()
  })

  after(() => {
    dbClient?.release()
  })

  test('Referential Integrity: Audit events are preserved and immutable on workspace deletion', async () => {
    const testWsId = `ws_audit_test_${Date.now()}`
    const testUserId = `usr_audit_test_${Date.now()}`

    // Insert user and workspace
    await dbClient.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, $3)`, [testUserId, `${testUserId}@example.test`, 'Audit Tester'])
    await dbClient.query(`INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)`, [testWsId, 'Audit WS', `slug_${testWsId}`])

    // Insert audit event referencing this workspace
    const auditId = `aud_evt_${Date.now()}`
    await dbClient.query(
      `INSERT INTO audit_events (id, chain_key, seq, workspace_id, actor_type, actor_id, actor_label, action, outcome, prev_hash, hash, created_at)
       VALUES ($1, $2, 1, $3, 'user', $4, 'Audit Tester', 'workspace.create', 'success', 'GENESIS', 'hash_001', now())`,
      [auditId, `ws:${testWsId}`, testWsId, testUserId]
    )

    // Verify audit event exists
    const checkAudit = await dbClient.query(`SELECT * FROM audit_events WHERE id = $1`, [auditId])
    assert.equal(checkAudit.rows.length, 1)

    // Delete workspace
    await dbClient.query(`DELETE FROM workspaces WHERE id = $1`, [testWsId])

    // Audit event must be preserved without error
    const postAudit = await dbClient.query(`SELECT * FROM audit_events WHERE id = $1`, [auditId])
    assert.equal(postAudit.rows.length, 1, 'Audit records must never be lost when a workspace is deleted')

    // Verify append-only trigger: Attempting to delete from audit_events directly MUST be rejected by DB
    let deleteBlocked = false
    try {
      await dbClient.query(`DELETE FROM audit_events WHERE id = $1`, [auditId])
    } catch (err) {
      deleteBlocked = err.message.includes('append-only')
    }
    assert.ok(deleteBlocked, 'audit_events table must reject DELETE queries via audit_events_immutable trigger')

    await dbClient.query(`DELETE FROM users WHERE id = $1`, [testUserId])
  })

  test('Concurrency: Simultaneous spend-intent approval race condition guarantees at most 1 approval', async () => {
    const testWsId = `ws_race_${Date.now()}`
    const testUserId = `usr_race_${Date.now()}`
    const testWalletId = `wal_race_${Date.now()}`
    const testIntentId = `spi_race_${Date.now()}`

    await dbClient.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, $3)`, [testUserId, `${testUserId}@example.test`, 'Race Tester'])
    await dbClient.query(`INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)`, [testWsId, 'Race WS', `slug_${testWsId}`])
    await dbClient.query(
      `INSERT INTO watched_wallets (id, workspace_id, label, address, chain_id, wallet_type, owner_user_id, created_by_id)
       VALUES ($1, $2, 'Race Wallet', $3, 1, 'treasury', $4, $4)`,
      [testWalletId, testWsId, '0x' + '33'.repeat(20), testUserId]
    )

    // Create an intent in pending_approval
    await dbClient.query(
      `INSERT INTO spend_intents (id, workspace_id, wallet_id, chain_id, from_address, to_address, asset_type, asset_symbol, decimals, amount, purpose, params_hash, idempotency_key, status)
       VALUES ($1, $2, $3, 1, $4, $5, 'native', 'ETH', 18, '1000', 'Race test', $6, $7, 'pending_approval')`,
      [testIntentId, testWsId, testWalletId, '0x' + '33'.repeat(20), '0x' + '44'.repeat(20), '0x' + '99'.repeat(32), `idem_${testIntentId}`]
    )

    // Simulate 2 parallel approval transactions competing to approve the same intent
    const approveAttempt = async (approverId) => {
      const client = await getClient()
      try {
        await client.query('BEGIN')
        // SELECT FOR UPDATE enforces row-level lock
        const row = await client.query(`SELECT status FROM spend_intents WHERE id = $1 FOR UPDATE`, [testIntentId])
        if (row.rows[0]?.status !== 'pending_approval') {
          await client.query('ROLLBACK')
          return { success: false, reason: 'ALREADY_TRANSITIONED' }
        }
        await client.query(`UPDATE spend_intents SET status = 'approved' WHERE id = $1`, [testIntentId])
        await client.query('COMMIT')
        return { success: true }
      } catch (err) {
        await client.query('ROLLBACK')
        return { success: false, error: err.message }
      } finally {
        client.release()
      }
    }

    // Run both simultaneously
    const results = await Promise.all([approveAttempt('approver_1'), approveAttempt('approver_2')])

    const successes = results.filter((r) => r.success)
    const failures = results.filter((r) => !r.success)

    assert.equal(successes.length, 1, 'Exactly one concurrent approval must succeed')
    assert.equal(failures.length, 1, 'Second concurrent approval must be rejected')

    // Cleanup
    await dbClient.query(`DELETE FROM spend_intents WHERE id = $1`, [testIntentId])
    await dbClient.query(`DELETE FROM watched_wallets WHERE id = $1`, [testWalletId])
    await dbClient.query(`DELETE FROM workspaces WHERE id = $1`, [testWsId])
    await dbClient.query(`DELETE FROM users WHERE id = $1`, [testUserId])
  })

  test('Unique Constraint: Duplicate wallet cannot be inserted with same address & chain in same workspace', async () => {
    const testWsId = `ws_uniq_${Date.now()}`
    const testUserId = `usr_uniq_${Date.now()}`
    const walletAddress = '0x' + '77'.repeat(20)

    await dbClient.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, $3)`, [testUserId, `${testUserId}@example.test`, 'Uniq Tester'])
    await dbClient.query(`INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)`, [testWsId, 'Uniq WS', `slug_${testWsId}`])

    // Insert 1st wallet
    await dbClient.query(
      `INSERT INTO watched_wallets (id, workspace_id, label, address, chain_id, wallet_type, owner_user_id, created_by_id)
       VALUES ($1, $2, 'W1', $3, 1, 'treasury', $4, $4)`,
      [`wal_1_${Date.now()}`, testWsId, walletAddress, testUserId]
    )

    // Attempting to insert 2nd wallet with identical workspace_id, address, and chain_id
    let duplicateRejected = false
    try {
      await dbClient.query(
        `INSERT INTO watched_wallets (id, workspace_id, label, address, chain_id, wallet_type, owner_user_id, created_by_id)
         VALUES ($1, $2, 'W2', $3, 1, 'treasury', $4, $4)`,
        [`wal_2_${Date.now()}`, testWsId, walletAddress, testUserId]
      )
    } catch (err) {
      duplicateRejected = true
    }

    assert.ok(duplicateRejected, 'Duplicate wallet in same workspace & chain must be rejected by unique constraint')

    // Cleanup
    await dbClient.query(`DELETE FROM watched_wallets WHERE workspace_id = $1`, [testWsId])
    await dbClient.query(`DELETE FROM workspaces WHERE id = $1`, [testWsId])
    await dbClient.query(`DELETE FROM users WHERE id = $1`, [testUserId])
  })
})
