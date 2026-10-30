import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_USERS } from '../../fixtures/identities.fixture.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Wallets & Challenge Verification', () => {
  let pritamCookie = ''

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
    if (setCookie) pritamCookie = setCookie.split(';')[0]
  })

  test('POST /auth/wallet/challenge - generates challenge message for signing', async () => {
    const res = await fetch(`${BASE_URL}/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        chainId: 1,
      }),
    })
    assert.ok(res.status === 200 || res.status === 201)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.challenge || data.data.message)
  })

  test('GET /auth/wallets - requires authentication', async () => {
    const res = await fetch(`${BASE_URL}/auth/wallets`)
    assert.equal(res.status, 401)
  })

  test('GET /auth/wallets - succeeds when authenticated', async () => {
    if (!pritamCookie) return test.skip('No auth cookie')
    const res = await fetch(`${BASE_URL}/auth/wallets`, {
      headers: { Cookie: pritamCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
  })
})
