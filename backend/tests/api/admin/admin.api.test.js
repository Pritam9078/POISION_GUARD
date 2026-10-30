import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Admin & Platform Operations', () => {
  let adminCookie = ''

  test('POST /admin/login - rejects invalid credentials', async () => {
    const res = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@poisonguard.com',
        password: 'IncorrectPassword!',
      }),
    })
    assert.equal(res.status, 401)
  })

  test('POST /admin/login - successfully signs in staff and issues staff cookie', async () => {
    const res = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@poisonguard.com',
        password: 'PoisonGuardAdmin2026!',
      }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.data.signedIn, true)

    const setCookie = res.headers.get('set-cookie')
    assert.ok(setCookie, 'Must set pg_staff_sid cookie')
    adminCookie = setCookie.split(';')[0]
  })

  test('GET /admin/session - verifies staff session and capabilities', async () => {
    if (!adminCookie) return test.skip('No admin cookie')
    const res = await fetch(`${BASE_URL}/admin/session`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.staff)
    assert.ok(data.data.staff.capabilities.includes('platform.view'))
  })

  test('GET /admin/overview - returns platform metrics', async () => {
    if (!adminCookie) return test.skip('No admin cookie')
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.scansTotal !== undefined)
  })

  test('GET /admin/health - returns subsystem integration health', async () => {
    if (!adminCookie) return test.skip('No admin cookie')
    const res = await fetch(`${BASE_URL}/admin/health`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(Array.isArray(data.data.items))
  })
})

