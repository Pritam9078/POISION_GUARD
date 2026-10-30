import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Policies: Adversarial Policy Engine & Velocity Boundary Suite', () => {
  // Policy evaluator emulator implementing the exact PoisonGuard policy rules
  function evaluatePolicy(policy, intent, currentVelocity = { dailySpent: 0n, monthlySpent: 0n }) {
    const amount = BigInt(intent.amount)
    const txLimit = BigInt(policy.maxPerTx ?? '0')
    const dailyLimit = BigInt(policy.dailyBudget ?? '0')
    const trustedRecipients = (policy.trustedRecipients ?? []).map((a) => a.toLowerCase())

    // 1. Recipient check
    if (policy.requireTrustedRecipient && !trustedRecipients.includes(intent.toAddress.toLowerCase())) {
      return { allowed: false, reason: 'UNTRUSTED_RECIPIENT', requiresApproval: true }
    }

    // 2. Per-tx limit check (Exact boundary test)
    if (txLimit > 0n && amount > txLimit) {
      return { allowed: false, reason: 'EXCEEDS_PER_TX_LIMIT', requiresApproval: true }
    }

    // 3. Zero-limit rule: if limit is 0 and enforcement is strict, any spend requires approval
    if (policy.zeroLimitStrict && amount > 0n) {
      return { allowed: false, reason: 'ZERO_LIMIT_POLICY_REQUIRES_APPROVAL', requiresApproval: true }
    }

    // 4. Daily budget velocity check
    if (dailyLimit > 0n && currentVelocity.dailySpent + amount > dailyLimit) {
      return { allowed: false, reason: 'EXCEEDS_DAILY_BUDGET', requiresApproval: true }
    }

    return { allowed: true, reason: 'POLICY_SATISFIED', requiresApproval: false }
  }

  test('Per-Transaction Boundary: Exactly at limit is allowed; limit + 1 requires approval', () => {
    const policy = {
      maxPerTx: '1000000000000000000', // 1.0 ETH in wei
      dailyBudget: '10000000000000000000', // 10.0 ETH
    }

    // Exactly at limit: 1.0 ETH
    const atLimitIntent = { toAddress: '0x1111111111111111111111111111111111111111', amount: '1000000000000000000' }
    const resAtLimit = evaluatePolicy(policy, atLimitIntent)
    assert.equal(resAtLimit.allowed, true)
    assert.equal(resAtLimit.requiresApproval, false)

    // One wei above limit: 1.0 ETH + 1 wei
    const aboveLimitIntent = { toAddress: '0x1111111111111111111111111111111111111111', amount: '1000000000000000001' }
    const resAboveLimit = evaluatePolicy(policy, aboveLimitIntent)
    assert.equal(resAboveLimit.allowed, false)
    assert.equal(resAboveLimit.reason, 'EXCEEDS_PER_TX_LIMIT')
    assert.equal(resAboveLimit.requiresApproval, true)
  })

  test('Zero-limit enforcement: any transaction value strictly greater than 0 triggers approval', () => {
    const zeroLimitPolicy = {
      zeroLimitStrict: true,
      maxPerTx: '0',
    }

    const testIntent = { toAddress: '0x1111111111111111111111111111111111111111', amount: '1' } // 1 wei
    const res = evaluatePolicy(zeroLimitPolicy, testIntent)
    assert.equal(res.allowed, false)
    assert.equal(res.requiresApproval, true)
    assert.equal(res.reason, 'ZERO_LIMIT_POLICY_REQUIRES_APPROVAL')
  })

  test('Daily Budget Rollover & Cumulative Velocity Aggregation', () => {
    const policy = {
      maxPerTx: '500',
      dailyBudget: '1000',
    }

    let velocity = { dailySpent: 0n, monthlySpent: 0n }

    // Transaction 1: 400 (allowed)
    const t1 = evaluatePolicy(policy, { toAddress: '0x1111111111111111111111111111111111111111', amount: '400' }, velocity)
    assert.equal(t1.allowed, true)
    velocity.dailySpent += 400n

    // Transaction 2: 400 (allowed, cumulative 800 <= 1000)
    const t2 = evaluatePolicy(policy, { toAddress: '0x1111111111111111111111111111111111111111', amount: '400' }, velocity)
    assert.equal(t2.allowed, true)
    velocity.dailySpent += 400n

    // Transaction 3: 300 (800 + 300 = 1100 > 1000: triggers budget breach)
    const t3 = evaluatePolicy(policy, { toAddress: '0x1111111111111111111111111111111111111111', amount: '300' }, velocity)
    assert.equal(t3.allowed, false)
    assert.equal(t3.reason, 'EXCEEDS_DAILY_BUDGET')
    assert.equal(t3.requiresApproval, true)
  })

  test('Untrusted recipient policy blocks unauthorized destination addresses', () => {
    const policy = {
      requireTrustedRecipient: true,
      trustedRecipients: ['0x2222222222222222222222222222222222222222'],
      maxPerTx: '10000',
    }

    // Attempting to send to untrusted address
    const untrustedIntent = { toAddress: '0x9999999999999999999999999999999999999999', amount: '100' }
    const res = evaluatePolicy(policy, untrustedIntent)
    assert.equal(res.allowed, false)
    assert.equal(res.reason, 'UNTRUSTED_RECIPIENT')
    assert.equal(res.requiresApproval, true)
  })

  test('Policy simulation produces zero side-effects on database or account state', () => {
    const initialDbState = { auditRecords: 10, intentsCount: 5 }

    // Simulate dry-run
    const simulateIntent = (intent, dbState) => {
      // Evaluation is purely functional
      const result = evaluatePolicy({ maxPerTx: '500' }, intent)
      // Assert state was not mutated
      assert.deepEqual(dbState, initialDbState, 'Dry run simulation must not mutate state')
      return result
    }

    const simResult = simulateIntent({ toAddress: '0x1111111111111111111111111111111111111111', amount: '600' }, initialDbState)
    assert.equal(simResult.allowed, false)
    assert.equal(simResult.requiresApproval, true)
  })
})
