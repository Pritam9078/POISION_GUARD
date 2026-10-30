import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('State Machine: Spend Intent FSM Transitions & Guardrails', () => {
  // Formal definition of allowed state transitions
  const ALLOWED_TRANSITIONS = {
    draft: ['evaluated', 'cancelled'],
    evaluated: ['pending_approval', 'ready_for_signing', 'cancelled'],
    pending_approval: ['approved', 'denied', 'cancelled'],
    denied: ['cancelled'],
    approved: ['ready_for_signing', 'cancelled'],
    ready_for_signing: ['submitted', 'cancelled'],
    submitted: ['confirmed', 'failed', 'reverted'],
    confirmed: [], // Terminal state
    failed: ['cancelled'],
    reverted: ['cancelled'],
    cancelled: [], // Terminal state
  }

  function validateTransition(currentStatus, nextStatus) {
    const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || []
    if (!validNextStates.includes(nextStatus)) {
      const err = new Error(`INVALID_STATE_TRANSITION: Cannot transition from ${currentStatus} to ${nextStatus}`)
      err.code = 'INVALID_STATE_TRANSITION'
      throw err
    }
    return true
  }

  test('Valid sequential state transition lifecycle: draft -> evaluated -> pending -> approved -> ready -> submitted -> confirmed', () => {
    let status = 'draft'

    status = 'evaluated'
    assert.equal(validateTransition('draft', status), true)

    status = 'pending_approval'
    assert.equal(validateTransition('evaluated', status), true)

    status = 'approved'
    assert.equal(validateTransition('pending_approval', status), true)

    status = 'ready_for_signing'
    assert.equal(validateTransition('approved', status), true)

    status = 'submitted'
    assert.equal(validateTransition('ready_for_signing', status), true)

    status = 'confirmed'
    assert.equal(validateTransition('submitted', status), true)
  })

  test('Forbidden Transitions: Illegal shortcuts and backward transitions are rejected', () => {
    // 1. Cannot jump directly from draft to confirmed
    assert.throws(() => validateTransition('draft', 'confirmed'), /INVALID_STATE_TRANSITION/)

    // 2. Cannot submit a denied intent
    assert.throws(() => validateTransition('denied', 'submitted'), /INVALID_STATE_TRANSITION/)

    // 3. Cannot approve an expired/cancelled intent
    assert.throws(() => validateTransition('cancelled', 'approved'), /INVALID_STATE_TRANSITION/)

    // 4. Cannot rollback confirmed intent to draft
    assert.throws(() => validateTransition('confirmed', 'draft'), /INVALID_STATE_TRANSITION/)

    // 5. Cannot re-approve an already confirmed intent
    assert.throws(() => validateTransition('confirmed', 'approved'), /INVALID_STATE_TRANSITION/)
  })

  test('Terminal State Immutability: confirmed and cancelled states allow zero forward transitions', () => {
    const allStatuses = Object.keys(ALLOWED_TRANSITIONS)

    for (const target of allStatuses) {
      assert.throws(() => validateTransition('confirmed', target), /INVALID_STATE_TRANSITION/)
      assert.throws(() => validateTransition('cancelled', target), /INVALID_STATE_TRANSITION/)
    }
  })

  test('Parameter Tampering Invalidation: Intent parameters cannot be altered after approval', () => {
    const originalIntent = {
      id: 'spi_123',
      toAddress: '0x1111111111111111111111111111111111111111',
      amount: '1000',
      status: 'approved',
      paramsHash: 'hash_original_params_001',
    }

    // Attacker modifies recipient to stolen address
    const tamperedIntent = {
      ...originalIntent,
      toAddress: '0x9999999999999999999999999999999999999999',
    }

    const computeParamsHash = (intent) => `hash_${intent.toAddress}_${intent.amount}`

    const originalHash = computeParamsHash(originalIntent)
    const tamperedHash = computeParamsHash(tamperedIntent)

    assert.notEqual(originalHash, tamperedHash, 'Params hash must diverge on alteration')

    // Verification check before signing
    const verifyBeforeSign = (intent, expectedHash) => {
      const currentHash = computeParamsHash(intent)
      if (currentHash !== expectedHash) {
        const err = new Error('INTEGRITY_VIOLATION: Intent parameters modified after approval')
        err.code = 'INTEGRITY_VIOLATION'
        throw err
      }
      return true
    }

    assert.equal(verifyBeforeSign(originalIntent, originalHash), true)
    assert.throws(() => verifyBeforeSign(tamperedIntent, originalHash), /INTEGRITY_VIOLATION/)
  })
})
