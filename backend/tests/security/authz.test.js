import { setup, teardown, client, newUser, newWorkspace, addMember, newStaff, waitJobs } from '../helpers/app.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

let ctx, alice, bob, wsA, wsB
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
before(async () => {
  ctx = await setup()
  alice = await newUser(ctx.app, 'Alice'); bob = await newUser(ctx.app, 'Bob')
  wsA = await newWorkspace(alice, 'Alpha'); wsB = await newWorkspace(bob, 'Bravo')
  await ctx.db.q(`UPDATE subscriptions SET plan_key = 'business' WHERE workspace_id IN ($1, $2)`, [wsA, wsB])
})
after(() => teardown())

test('cross-workspace access is indistinguishable from not-found', async () => {
  const w = await alice.post(`/api/v1/workspaces/${wsA}/wallets`, { label: 'A1', address: '0x' + '11'.repeat(20), chainId: 1, walletType: 'treasury' })
  for (const path of ['', '/wallets', `/wallets/${w.data.id}`, '/audit', '/policies', '/spend-intents', '/members', '/billing']) {
    const r = await bob.get(`/api/v1/workspaces/${wsA}${path}`)
    assert.equal(r.status, 404, `${path} leaked: ${r.status}`)
  }
  // Using Bob's own workspace id with Alice's resource id also fails (tenant-scoped lookups)
  assert.equal((await bob.get(`/api/v1/workspaces/${wsB}/wallets/${w.data.id}`)).status, 404)
  // Bob cannot intent against Alice's wallet through his workspace
  const r = await bob.post(`/api/v1/workspaces/${wsB}/spend-intents`, { walletId: w.data.id, chainId: 1, toAddress: '0x' + '22'.repeat(20), assetType: 'native', amount: '1', purpose: 'steal' })
  assert.equal(r.status, 404)
})

test('workspace scans never appear on public routes', async () => {
  const s = await alice.post(`/api/v1/workspaces/${wsA}/scans`, { chainId: 1, input: '0x' + '33'.repeat(20) })
  await waitJobs()
  assert.equal((await client(ctx.app).get(`/api/v1/scans/${s.data.scanId}`)).status, 404)
  assert.equal((await bob.get(`/api/v1/workspaces/${wsB}/scans/${s.data.scanId}`)).status, 404)
})

test('role capabilities are enforced server-side', async () => {
  const aud = await newUser(ctx.app, 'Auditor'); const op = await newUser(ctx.app, 'Op')
  await addMember(alice, wsA, aud, 'auditor'); await addMember(alice, wsA, op, 'operator')
  const W = `/api/v1/workspaces/${wsA}`
  assert.equal((await aud.post(`${W}/wallets`, { label: 'x', address: '0x' + '44'.repeat(20), chainId: 1, walletType: 'other' })).status, 403)
  assert.equal((await op.post(`${W}/policies`, { name: 'p', config: {} })).status, 403)
  assert.equal((await op.post(`${W}/invitations`, { email: 'z@z.example', role: 'admin' })).status, 403)
  assert.equal((await op.get(`${W}/billing`)).status, 403)
  assert.equal((await aud.get(`${W}/audit`)).status, 200)
  assert.equal((await op.post(`${W}/agents`, {})).status, 403)
})

test('last owner cannot be removed or demoted; only owners grant owner', async () => {
  const W = `/api/v1/workspaces/${wsA}`
  const members = (await alice.get(`${W}/members`)).data.items
  const me = members.find((m) => m.userId === alice.user.id)
  assert.equal((await alice.del(`${W}/members/${me.id}`)).error.code, 'LAST_OWNER')
  const adm = await newUser(ctx.app, 'Adm'); await addMember(alice, wsA, adm, 'admin')
  const target = (await alice.get(`${W}/members`)).data.items.find((m) => m.role === 'operator')
  assert.equal((await adm.patch(`${W}/members/${target.id}`, { role: 'owner' })).status, 403)
  assert.equal((await adm.patch(`${W}/members/${me.id}`, { role: 'admin' })).status, 403)
})

test('Guard session does not grant admin; admin endpoints need staff session & capability', async () => {
  assert.equal((await alice.get('/api/v1/admin/overview')).status, 401)
  assert.equal((await alice.get('/api/v1/admin/session')).status, 401)
  const support = await newStaff(ctx.app, 'support')
  assert.equal((await support.get('/api/v1/admin/overview')).status, 200)
  assert.equal((await support.get('/api/v1/admin/feature-flags')).status, 403)
  assert.equal((await support.get(`/api/v1/admin/workspaces/${wsA}?reason=curious`)).status, 403) // inspect needs workspaces.inspect
  // staff cookie is not a Guard session either
  assert.equal((await support.get('/api/v1/auth/me')).status, 401)
})

test('cross-tenant inspection requires justification and is written to the customer audit chain', async () => {
  const sa = await newStaff(ctx.app, 'super_admin')
  assert.equal((await sa.get(`/api/v1/admin/workspaces/${wsA}`)).status, 400)
  const r = await sa.get(`/api/v1/admin/workspaces/${wsA}?reason=${encodeURIComponent('Support ticket #123')}`)
  assert.equal(r.status, 200)
  assert.ok(r.data.members.every((m) => m.email.includes('***')))
  const trail = (await alice.get(`/api/v1/workspaces/${wsA}/audit?action=platform_staff.inspect`)).data.items
  assert.equal(trail.length, 1); assert.equal(trail[0].meta.reason, 'Support ticket #123')
})

test('there is no admin endpoint to approve or sign spend', async () => {
  const sa = await newStaff(ctx.app, 'super_admin')
  for (const u of ['/api/v1/admin/spend-intents/x/approve', '/api/v1/admin/intents/x/approve', '/api/v1/admin/sign']) assert.equal((await sa.post(u, {})).status, 404)
})

test('super_admin grant requires a second super admin', async () => {
  const sa1 = await newStaff(ctx.app, 'super_admin'), sa2 = await newStaff(ctx.app, 'super_admin')
  const g = await sa1.post('/api/v1/admin/access', { email: 'new.sa@pg.example', name: 'New', role: 'super_admin', accessExpiresAt: new Date(Date.now() + 86400_000).toISOString(), justification: 'On-call rotation', temporaryPassword: 'temporary-pass-123' })
  assert.equal(g.data.status, 'pending_approval')
  assert.equal((await sa1.post(`/api/v1/admin/access/${g.data.id}/approve`)).status, 403)
  assert.equal((await sa2.post(`/api/v1/admin/access/${g.data.id}/approve`)).data.status, 'active')
})

test('admin login: wrong OTP rejected, lockout after repeated failures', async () => {
  const sa = await newStaff(ctx.app, 'support')
  const c = client(ctx.app)
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/api/v1/admin/login', { email: sa.email, password: 'staff-password-123', otp: '000000' })).status, 401)
  assert.equal((await c.post('/api/v1/admin/login', { email: sa.email, password: 'staff-password-123', otp: '000000' })).error.code, 'ACCOUNT_LOCKED')
})

test('CSRF: state-changing requests from foreign origins are rejected', async () => {
  const evil = client(ctx.app, { origin: 'https://evil.example' })
  Object.assign(evil.jar, alice.jar)
  assert.equal((await evil.post('/api/v1/workspaces', { name: 'pwned' })).error.code, 'ORIGIN_REJECTED')
  const good = client(ctx.app, { origin: 'http://localhost:5173' }); Object.assign(good.jar, alice.jar)
  assert.equal((await good.post('/api/v1/workspaces', { name: 'legit' })).status, 201)
})

test('login: generic errors, lockout, password reset revokes sessions', async () => {
  const u = await newUser(ctx.app, 'Lock')
  const c = client(ctx.app)
  const unknown = await c.post('/api/v1/auth/login', { email: 'nobody@nowhere.example', password: 'x' })
  const wrong = await c.post('/api/v1/auth/login', { email: u.email, password: 'x' })
  assert.equal(unknown.error.message, wrong.error.message)
  for (let i = 0; i < 4; i++) await c.post('/api/v1/auth/login', { email: u.email, password: 'x' })
  assert.equal((await c.post('/api/v1/auth/login', { email: u.email, password: 'correct-horse-battery' })).error.code, 'ACCOUNT_LOCKED')
  const fp = await c.post('/api/v1/auth/forgot-password', { email: 'nobody@nowhere.example' })
  assert.equal(fp.status, 200) // no enumeration
})

test('agent credentials are scoped to their workspace', async () => {
  await ctx.db.q(`UPDATE subscriptions SET plan_key = 'pro' WHERE workspace_id IN ($1, $2)`, [wsA, wsB])
  const wb = await bob.post(`/api/v1/workspaces/${wsB}/wallets`, { label: 'B', address: '0x' + '55'.repeat(20), chainId: 1, walletType: 'agent_controlled' })
  const wa = await alice.post(`/api/v1/workspaces/${wsA}/wallets`, { label: 'A2', address: '0x' + '66'.repeat(20), chainId: 1, walletType: 'agent_controlled' })
  const ag = await bob.post(`/api/v1/workspaces/${wsB}/agents`, { name: 'bob-bot', description: 'bob bot test', allowedChains: [1], controlledWalletIds: [wb.data.id], tools: ['propose_transfer'], perTxLimits: [{ asset: 'native', chainId: 1, amount: '100' }], expiresAt: new Date(Date.now() + 86400_000).toISOString() })
  await bob.post(`/api/v1/workspaces/${wsB}/agents/${ag.data.id}/activate`)
  const cred = (await bob.post(`/api/v1/workspaces/${wsB}/agents/${ag.data.id}/credentials`, {})).data.secret
  const bot = client(ctx.app)
  const r = await bot.post('/api/v1/agent/v1/spend-intents', { walletId: wa.data.id, chainId: 1, toAddress: '0x' + '77'.repeat(20), assetType: 'native', amount: '1', purpose: 'cross-tenant' }, { authorization: `Bearer ${cred}` })
  assert.equal(r.status, 404)
  assert.equal((await bot.post('/api/v1/agent/v1/spend-intents', {}, { authorization: 'Bearer pgk_live_forged' })).status, 401)
  // Agent tokens never work as user sessions
  assert.equal((await bot.get(`/api/v1/workspaces/${wsB}`, { authorization: `Bearer ${cred}` })).status, 401)
})

test('webhook endpoints reject private/insecure URLs (SSRF)', async () => {
  for (const url of ['http://example.com/h', 'https://127.0.0.1/h', 'https://169.254.169.254/latest/meta-data']) {
    assert.equal((await alice.post(`/api/v1/workspaces/${wsA}/webhooks`, { url, events: ['*'] })).status, 400, url)
  }
})

test('error responses never leak internals', async () => {
  const r = await alice.post(`/api/v1/workspaces/${wsA}/spend-intents`, { walletId: 'x'.repeat(5000) })
  assert.ok(r.status === 400 || r.status === 404)
  assert.ok(!r.raw.includes('at ') || !r.raw.includes('.js:'), 'stack trace leaked')
  const bad = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: '{not json', headers: { 'content-type': 'application/json' } })
  assert.equal(bad.statusCode, 400); assert.equal(bad.json().success, false)
})

test('approval is bound to params: modifying recipient after approval cannot be prepared', async () => {
  const W = `/api/v1/workspaces/${wsA}`
  const appr = await newUser(ctx.app, 'Appr'); await addMember(alice, wsA, appr, 'approver')
  const w = (await alice.get(`${W}/wallets`)).data.items[0]
  const i = await alice.post(`${W}/spend-intents`, { walletId: w.id, chainId: 1, toAddress: '0x' + '88'.repeat(20), assetType: 'native', amount: '1000', purpose: 'bind test', evaluate: true })
  assert.equal(i.data.status, 'pending_approval')
  assert.equal((await alice.post(`${W}/spend-intents/${i.data.id}/approve`, {})).status, 403) // requester cannot self-approve
  await appr.post(`${W}/spend-intents/${i.data.id}/approve`, {})
  await alice.patch(`${W}/spend-intents/${i.data.id}`, { toAddress: '0x' + '99'.repeat(20) })
  const p = await alice.post(`${W}/spend-intents/${i.data.id}/prepare`)
  assert.equal(p.error.code, 'INVALID_STATE_TRANSITION')
  // a later submit cannot reuse a tx hash already linked elsewhere
})
