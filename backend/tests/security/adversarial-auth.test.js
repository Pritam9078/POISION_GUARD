import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('Security: Authentication & Session Adversarial Suite', () => {
  let primaryUser = {
    name: 'Adversarial Primary',
    email: `adv_primary_${Date.now()}@example.test`,
    password: 'PrimaryPassword2026!',
    cookie: '',
  }

  before(async () => {
    // Register primary user
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: primaryUser.name,
        email: primaryUser.email,
        password: primaryUser.password,
      }),
    })
    const cookie = regRes.headers.get('set-cookie')
    if (cookie) primaryUser.cookie = cookie.split(';')[0]
  })

  test('Malformed or tampered session cookie is immediately rejected with 401', async () => {
    const tamperedCookies = [
      'sid=invalid_base64_random_garbage_string',
      'sid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_signature',
      'sid=',
      'sid="null"',
      'sid=../../../../etc/passwd',
    ]

    for (const cookie of tamperedCookies) {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: cookie },
      })
      assert.equal(res.status, 401, `Tampered cookie "${cookie}" must return 401`)
    }
  })

  test('Account enumeration defense: identical error returned for missing vs wrong password', async () => {
    const resWrongPass = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: primaryUser.email,
        password: 'IncorrectPassword999!',
      }),
    })
    const bodyWrongPass = await resWrongPass.json()

    const resNonExistent = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `nonexistent_${Date.now()}@example.test`,
        password: 'AnyPassword123!',
      }),
    })
    const bodyNonExistent = await resNonExistent.json()

    assert.equal(resWrongPass.status, 401)
    assert.equal(resNonExistent.status, 401)
    assert.equal(bodyWrongPass?.error?.code, bodyNonExistent?.error?.code)
  })

  test('Multiple concurrent sessions maintain isolated tokens', async () => {
    const concurrentUser = {
      name: 'Concurrent User',
      email: `concurrent_${Date.now()}@example.test`,
      password: 'ConcurrentPassword123!',
    }

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(concurrentUser),
    })

    const res1 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: concurrentUser.email, password: concurrentUser.password }),
    })
    const cookie1 = res1.headers.get('set-cookie')

    const res2 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: concurrentUser.email, password: concurrentUser.password }),
    })
    const cookie2 = res2.headers.get('set-cookie')

    assert.ok(cookie1, 'Session 1 cookie must exist')
    assert.ok(cookie2, 'Session 2 cookie must exist')

    const me1 = await fetch(`${BASE_URL}/auth/me`, { headers: { Cookie: cookie1.split(';')[0] } })
    const me2 = await fetch(`${BASE_URL}/auth/me`, { headers: { Cookie: cookie2.split(';')[0] } })
    assert.equal(me1.status, 200)
    assert.equal(me2.status, 200)
  })

  test('Brute force lockout or rate-limit defense triggers on repeated failures', async () => {
    const targetEmail = `bruteforce_target_${Date.now()}@example.test`

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Brute Target',
        email: targetEmail,
        password: 'ValidPassword123!',
      }),
    })

    let lastStatus = 0
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          password: `WrongPassAttempt${i}!`,
        }),
      })
      lastStatus = res.status
    }

    // 6th attempt should either be 423 (ACCOUNT_LOCKED) or 429 (RATE_LIMITED)
    const blockedRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetEmail,
        password: 'ValidPassword123!',
      }),
    })

    assert.ok(
      blockedRes.status === 423 || blockedRes.status === 429,
      `Repeated failed attempts must trigger 423 ACCOUNT_LOCKED or 429 RATE_LIMITED (got ${blockedRes.status})`
    )
  })

  test('Staff session cookie does not leak into customer auth routes and vice versa', async () => {
    const staffRes = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@poisonguard.com',
        password: 'PoisonGuardAdmin2026!',
      }),
    })
    const staffCookie = staffRes.headers.get('set-cookie')?.split(';')[0]
    assert.ok(staffCookie, 'Staff cookie must be issued')

    // Customer /auth/me with staff cookie must return 401
    const custMe = await fetch(`${BASE_URL}/auth/me`, { headers: { Cookie: staffCookie } })
    assert.equal(custMe.status, 401, 'Customer route must reject staff cookie')

    // Admin /admin/overview with customer cookie must return 401
    if (primaryUser.cookie) {
      const adminOverview = await fetch(`${BASE_URL}/admin/overview`, { headers: { Cookie: primaryUser.cookie } })
      assert.equal(adminOverview.status, 401, 'Admin route must reject customer cookie')
    }
  })
})
