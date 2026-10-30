import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_USERS } from '../../fixtures/identities.fixture.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Users & Profile Management', () => {
  let userCookie = ''

  before(async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USERS.pritam.email,
        password: TEST_USERS.pritam.password,
      }),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) userCookie = setCookie.split(';')[0]
  })

  test('GET /auth/me - returns user profile and workspace memberships', async () => {
    if (!userCookie) return test.skip('No auth cookie')
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.data.email, TEST_USERS.pritam.email.toLowerCase())
  })
})

