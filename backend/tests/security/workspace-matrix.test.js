import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('Security: Workspace Isolation & Role Authorization Matrix', () => {
  let ownerAlpha = { name: 'Owner Alpha', email: `alpha_owner_${Date.now()}@test.example`, password: 'AlphaPassword123!', cookie: '', wsId: '' }
  let ownerBeta = { name: 'Owner Beta', email: `beta_owner_${Date.now()}@test.example`, password: 'BetaPassword123!', cookie: '', wsId: '' }
  let devAlpha = { name: 'Dev Alpha', email: `alpha_dev_${Date.now()}@test.example`, password: 'DevPassword123!', cookie: '' }
  let viewerAlpha = { name: 'Viewer Alpha', email: `alpha_viewer_${Date.now()}@test.example`, password: 'ViewerPassword123!', cookie: '' }
  let alphaWalletId = ''

  async function registerAndLogin(user) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.name, email: user.email, password: user.password }),
    })
    const cookie = res.headers.get('set-cookie')?.split(';')[0]
    user.cookie = cookie || ''
    return cookie
  }

  before(async () => {
    // 1. Create Owner Alpha & Workspace Alpha
    await registerAndLogin(ownerAlpha)
    const wsAlphaRes = await fetch(`${BASE_URL}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAlpha.cookie },
      body: JSON.stringify({ name: 'Workspace Alpha' }),
    })
    const wsAlphaJson = await wsAlphaRes.json()
    ownerAlpha.wsId = wsAlphaJson?.data?.id

    // Create a wallet inside Workspace Alpha
    const wRes = await fetch(`${BASE_URL}/workspaces/${ownerAlpha.wsId}/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAlpha.cookie },
      body: JSON.stringify({ label: 'Treasury Alpha', address: '0x' + 'aa'.repeat(20), chainId: 1, walletType: 'treasury' }),
    })
    const wJson = await wRes.json()
    alphaWalletId = wJson?.data?.id

    // 2. Create Owner Beta & Workspace Beta
    await registerAndLogin(ownerBeta)
    const wsBetaRes = await fetch(`${BASE_URL}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerBeta.cookie },
      body: JSON.stringify({ name: 'Workspace Beta' }),
    })
    const wsBetaJson = await wsBetaRes.json()
    ownerBeta.wsId = wsBetaJson?.data?.id

    // 3. Register Dev and Viewer users
    await registerAndLogin(devAlpha)
    await registerAndLogin(viewerAlpha)
  })

  test('Cross-tenant IDOR protection: Owner Beta cannot read Workspace Alpha resources', async () => {
    assert.ok(ownerAlpha.wsId, 'Workspace Alpha ID must exist')
    assert.ok(ownerBeta.cookie, 'Owner Beta cookie must exist')

    // Try reading Alpha's wallets using Beta's session
    const res = await fetch(`${BASE_URL}/workspaces/${ownerAlpha.wsId}/wallets`, {
      headers: { Cookie: ownerBeta.cookie },
    })
    // Must return 404 (indistinguishable from not found) to prevent tenant discovery
    assert.equal(res.status, 404, 'Must reject cross-tenant wallet access with 404')
  })

  test('Cross-tenant IDOR protection: Owner Beta cannot access Alpha wallet through Beta workspace', async () => {
    assert.ok(alphaWalletId, 'Alpha wallet ID must exist')

    // Try reading Alpha's specific wallet using Beta's workspace URL
    const res = await fetch(`${BASE_URL}/workspaces/${ownerBeta.wsId}/wallets/${alphaWalletId}`, {
      headers: { Cookie: ownerBeta.cookie },
    })
    assert.equal(res.status, 404, 'Must return 404 when querying a foreign resource in own workspace')
  })

  test('Cross-tenant spend intent prevention: Beta cannot submit spend intent against Alpha wallet', async () => {
    assert.ok(alphaWalletId, 'Alpha wallet ID must exist')

    const res = await fetch(`${BASE_URL}/workspaces/${ownerBeta.wsId}/spend-intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerBeta.cookie },
      body: JSON.stringify({
        walletId: alphaWalletId,
        chainId: 1,
        toAddress: '0x' + 'bb'.repeat(20),
        assetType: 'native',
        amount: '1000',
        purpose: 'Unauthorized cross-tenant spend',
      }),
    })
    assert.equal(res.status, 404, 'Cannot create spend intent against foreign wallet ID')
  })

  test('Non-existent or random workspace ID returns 404 without leaking internal errors', async () => {
    const randomWsId = 'ws_nonexistent_random_id_999999999999'
    const res = await fetch(`${BASE_URL}/workspaces/${randomWsId}`, {
      headers: { Cookie: ownerAlpha.cookie },
    })
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body?.success, false)
  })

  test('Unauthenticated caller cannot read or mutate any workspace resource', async () => {
    const endpoints = [
      `/workspaces/${ownerAlpha.wsId}`,
      `/workspaces/${ownerAlpha.wsId}/wallets`,
      `/workspaces/${ownerAlpha.wsId}/policies`,
      `/workspaces/${ownerAlpha.wsId}/spend-intents`,
      `/workspaces/${ownerAlpha.wsId}/members`,
      `/workspaces/${ownerAlpha.wsId}/audit`,
    ]

    for (const ep of endpoints) {
      const getRes = await fetch(`${BASE_URL}${ep}`)
      assert.equal(getRes.status, 401, `GET ${ep} must return 401 unauthenticated`)
    }

    // Mutating request without auth must return 401
    const postRes = await fetch(`${BASE_URL}/workspaces/${ownerAlpha.wsId}/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Hacker', address: '0x' + '99'.repeat(20), chainId: 1 }),
    })
    assert.equal(postRes.status, 401, 'POST without auth must return 401')
  })
})
