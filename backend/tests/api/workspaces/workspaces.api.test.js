import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_USERS } from '../../fixtures/identities.fixture.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Workspaces & RBAC', () => {
  let pritamCookie = ''
  let createdWsId = ''

  before(async () => {
    // Login as Pritam (Owner)
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
    }
  })

  test('POST /workspaces - Owner can create a new workspace', async () => {
    if (!pritamCookie) return test.skip('No auth session')
    const res = await fetch(`${BASE_URL}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pritamCookie,
      },
      body: JSON.stringify({
        name: `POISONGUARD_E2E_PritamWorkspace_${Date.now()}`,
      }),
    })
    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.id)
    createdWsId = data.data.id
  })

  test('GET /workspaces - Returns workspaces for authenticated owner', async () => {
    if (!pritamCookie) return test.skip('No auth session')
    const res = await fetch(`${BASE_URL}/workspaces`, {
      headers: { Cookie: pritamCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(Array.isArray(data.data.items || data.data))
  })

  test('POST /workspaces/:id/invitations - Owner can invite member', async () => {
    if (!pritamCookie || !createdWsId) return test.skip('No workspace created')
    const res = await fetch(`${BASE_URL}/workspaces/${createdWsId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pritamCookie,
      },
      body: JSON.stringify({
        email: TEST_USERS.stuti.email,
        role: 'member',
      }),
    })
    assert.ok(res.status === 201 || res.status === 200)
    const data = await res.json()
    assert.equal(data.success, true)
  })
})
