import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_USERS } from '../../fixtures/identities.fixture.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Authentication Flow', () => {
  let cookieJar = ''

  test('POST /auth/register - rejects empty body', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.equal(data.success, false)
  })

  test('POST /auth/register - rejects invalid email', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Email User',
        email: 'not-an-email',
        password: 'ValidPassword123!',
      }),
    })
    assert.equal(res.status, 400)
  })

  test('POST /auth/register - rejects weak password', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak Password User',
        email: 'weak_pw@poison-guard.test',
        password: '123',
      }),
    })
    assert.equal(res.status, 400)
  })

  test('POST /auth/register - creates Pritam test user successfully', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: TEST_USERS.pritam.name,
        email: TEST_USERS.pritam.email,
        password: TEST_USERS.pritam.password,
      }),
    })
    // 201 Created or 409 if already registered
    assert.ok(res.status === 201 || res.status === 409, `Unexpected status: ${res.status}`)
    const data = await res.json()
    if (res.status === 201) {
      assert.equal(data.success, true)
      assert.equal(data.data.user.email, TEST_USERS.pritam.email.toLowerCase())
      assert.equal(data.data.user.password, undefined) // Password must never leak
    }
  })

  test('POST /auth/login - rejects wrong password', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USERS.pritam.email,
        password: 'WrongPassword999!',
      }),
    })
    assert.equal(res.status, 401)
    const data = await res.json()
    assert.equal(data.success, false)
  })

  test('POST /auth/login - succeeds with valid credentials and sets session cookie', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USERS.pritam.email,
        password: TEST_USERS.pritam.password,
      }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.user)
    assert.equal(data.data.user.email, TEST_USERS.pritam.email.toLowerCase())

    const setCookie = res.headers.get('set-cookie')
    assert.ok(setCookie, 'Session cookie must be set')
    cookieJar = setCookie.split(';')[0]
  })

  test('GET /auth/me - returns user profile with valid session cookie', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: cookieJar },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.data.user.email, TEST_USERS.pritam.email.toLowerCase())
  })

  test('POST /auth/logout - clears session', async () => {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieJar },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
  })
})
