import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Billing & Dodo Payments Sandbox', () => {
  test('POST /webhooks/dodo - rejects invalid signature', async () => {
    const res = await fetch(`${BASE_URL}/webhooks/dodo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'webhook-id': 'wh_test_123',
        'webhook-timestamp': String(Date.now()),
        'webhook-signature': 'invalid-signature-hex',
      },
      body: JSON.stringify({
        event: 'payment.succeeded',
        data: { paymentId: 'test_pay_123' },
      }),
    })
    // Webhook should reject unauthorized signature (401)
    assert.equal(res.status, 401)
    const data = await res.json()
    assert.equal(data.success, false)
  })
})
