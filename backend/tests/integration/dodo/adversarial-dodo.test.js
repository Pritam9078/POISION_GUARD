import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

describe('Dodo Payments: Webhook Adversarial & Idempotency Suite', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret_key_1234567890'

  function signPayload(body, secret = WEBHOOK_SECRET) {
    return crypto.createHmac('sha256', secret).update(body).digest('hex')
  }

  function verifyWebhookSignature(payload, signatureHeader, secret = WEBHOOK_SECRET) {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    if (signatureHeader.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  }

  test('Signature Verification: Valid signature passes; forged signature is rejected', () => {
    const rawPayload = JSON.stringify({ event: 'payment.succeeded', paymentId: 'pay_123', amount: 9900 })
    const validSignature = signPayload(rawPayload)
    const forgedSignature = signPayload(rawPayload, 'wrong_secret_key_9999')

    assert.equal(verifyWebhookSignature(rawPayload, validSignature), true)
    assert.equal(verifyWebhookSignature(rawPayload, forgedSignature), false)
  })

  test('Webhook Idempotency: Processing identical event ID multiple times is idempotent', () => {
    const processedEvents = new Set()
    let balanceCredits = 0

    const processWebhook = (event) => {
      if (processedEvents.has(event.id)) {
        return { status: 'already_processed', duplicate: true }
      }
      processedEvents.add(event.id)
      balanceCredits += event.credits
      return { status: 'processed', duplicate: false }
    }

    const testEvent = { id: 'evt_dodo_idempotent_999', credits: 100 }

    // 1st delivery: processed
    const res1 = processWebhook(testEvent)
    assert.equal(res1.status, 'processed')
    assert.equal(res1.duplicate, false)
    assert.equal(balanceCredits, 100)

    // 2nd delivery (duplicate from network retry): deduplicated
    const res2 = processWebhook(testEvent)
    assert.equal(res2.status, 'already_processed')
    assert.equal(res2.duplicate, true)
    assert.equal(balanceCredits, 100, 'Credits must not be applied twice')
  })

  test('Out-of-order Delivery: Older timestamp event does not overwrite newer subscription state', () => {
    let subscriptionState = {
      plan: 'business',
      version: 2,
      updatedAt: 1000,
    }

    const handleSubscriptionWebhook = (event) => {
      // Discard stale out-of-order event
      if (event.version < subscriptionState.version) {
        return { applied: false, reason: 'STALE_OUT_OF_ORDER_EVENT' }
      }
      subscriptionState = { plan: event.plan, version: event.version, updatedAt: event.timestamp }
      return { applied: true }
    }

    // Stale delayed event arriving from earlier downgrade
    const delayedEvent = { plan: 'free', version: 1, timestamp: 500 }
    const result = handleSubscriptionWebhook(delayedEvent)

    assert.equal(result.applied, false)
    assert.equal(result.reason, 'STALE_OUT_OF_ORDER_EVENT')
    assert.equal(subscriptionState.plan, 'business', 'Current plan must not be downgraded by delayed stale event')
  })
})

