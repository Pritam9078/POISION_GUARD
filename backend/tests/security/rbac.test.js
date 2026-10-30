import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_USERS } from '../fixtures/identities.fixture.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('Security: Role-Based Access Control (RBAC) & Tenant Isolation', () => {
  let pritamCookie = ''
  let wsId = ''

  before(async () => {
    // Authenticate Pritam (Owner)
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
      const wsList = await (await fetch(`${BASE_URL}/workspaces`, { headers: { Cookie: pritamCookie } })).json()
      wsId = wsList?.data?.items?.[0]?.id || wsList?.data?.[0]?.id || 'ws_test_fallback'
    }
  })

  test('Unauthenticated user cannot access tenant-scoped workspace endpoints', async () => {
    const res = await fetch(`${BASE_URL}/workspaces/${wsId}/wallets`)
    assert.equal(res.status, 401, 'Unauthenticated request must return 401')
  })

  test('Non-admin customer user cannot access staff admin endpoints', async () => {
    if (!pritamCookie) return test.skip('No auth cookie')
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: { Cookie: pritamCookie },
    })
    // Customer cookie must NOT grant staff access
    assert.equal(res.status, 401)
  })

  test('Cross-tenant IDOR defense: cannot access random foreign workspace', async () => {
    if (!pritamCookie) return test.skip('No auth cookie')
    const foreignWsId = 'ws_foreign_tenant_9999999999'
    const res = await fetch(`${BASE_URL}/workspaces/${foreignWsId}/wallets`, {
      headers: { Cookie: pritamCookie },
    })
    assert.ok(res.status === 403 || res.status === 404, 'Must reject foreign workspace access with 403/404')
  })
})

