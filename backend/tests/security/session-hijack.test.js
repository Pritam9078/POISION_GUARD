import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('Security: Session Cookie Flags & Tampering Defense', () => {
  test('Session cookies set HttpOnly and SameSite attributes', async () => {
    const res = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@poisonguard.com',
        password: 'PoisonGuardAdmin2026!',
      }),
    })
    const setCookie = res.headers.get('set-cookie') || ''
    assert.match(setCookie.toLowerCase(), /httponly/, 'Cookie must enforce HttpOnly')
    assert.match(setCookie.toLowerCase(), /samesite/, 'Cookie must enforce SameSite')
  })

  test('Tampered / forged session cookie is rejected immediately', async () => {
    const res = await fetch(`${BASE_URL}/admin/session`, {
      headers: { Cookie: 'pg_staff_sid=forged_fake_session_token_12345' },
    })
    assert.equal(res.status, 401, 'Tampered cookie must return 401 Unauthorized')
  })
})
