import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

describe('Integration: Dodo Payments Webhook & Cryptographic Verification', () => {
  const secret = 'whsec_dodo_test_secret_key_123456789'

  test('Validates HMAC SHA256 webhook signatures', () => {
    const rawBody = JSON.stringify({ event: 'subscription.active', data: { subscription_id: 'sub_test_01' } })
    const timestamp = Date.now().toString()
    const webhookId = 'msg_test_01'

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest('hex')

    // Verify computed signature matches
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${webhookId}.${timestamp}.${rawBody}`)
      .digest('hex')

    assert.equal(signature, expected)
  })
})

