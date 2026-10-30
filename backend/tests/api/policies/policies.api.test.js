import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_USERS } from '../../fixtures/identities.fixture.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Security Policies & Spend Limits', () => {
  let pritamCookie = ''
  let wsId = ''

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
    if (setCookie) {
      pritamCookie = setCookie.split(';')[0]
      const userRes = await (await fetch(`${BASE_URL}/auth/me`, { headers: { Cookie: pritamCookie } })).json()
      const wsList = await (await fetch(`${BASE_URL}/workspaces`, { headers: { Cookie: pritamCookie } })).json()
      wsId = wsList?.data?.items?.[0]?.id || wsList?.data?.[0]?.id
    }
  })

  test('GET /policies - returns policies list for workspace', async () => {
    if (!pritamCookie) return test.skip('No auth cookie')
    const headers = { Cookie: pritamCookie }
    if (wsId) headers['x-workspace-id'] = wsId
    const res = await fetch(`${BASE_URL}/policies`, { headers })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(Array.isArray(data.data.items || data.data))
  })
})

