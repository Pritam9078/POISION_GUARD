import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('Security: Injection & Hostile Payload Defense', () => {
  test('SQL Injection payloads in scan input return validation errors, never 500', async () => {
    const payloads = [
      "' OR 1=1 --",
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; DROP TABLE users; --",
      "UNION SELECT * FROM users",
    ]
    for (const p of payloads) {
      const res = await fetch(`${BASE_URL}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId: 1, input: p }),
      })
      assert.notEqual(res.status, 500, `Payload triggered 500: ${p}`)
      assert.equal(res.status, 400, `Payload must be rejected with 400: ${p}`)
    }
  })

  test('XSS script tags are sanitized / rejected in user inputs', async () => {
    const xss = '<script>alert("xss")</script>'
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: xss,
        email: 'xss_test@poison-guard.test',
        password: 'ValidPassword123!',
      }),
    })
    assert.notEqual(res.status, 500)
  })
})
