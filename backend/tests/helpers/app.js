import './env.js'
import { Wallet } from 'ethers'
import { pool, db } from '../../src/db/index.js'
import { runMigrations } from '../../src/db/migrate.js'
import { seedReference } from '../../src/db/seed-reference.js'
import { buildApp } from '../../src/app.js'
import { setService, svc } from '../../src/services/registry.js'
import { FakeChain, fakeChainService } from './fake-chain.js'
import { hashPassword, newTotpSecret, encrypt, totpAt } from '../../src/shared/crypto.js'
import { newId } from '../../src/shared/ids.js'

let shared
export async function setup({ realChains = false } = {}) {
  if (shared) return shared
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await runMigrations(() => {})
  await seedReference()
  const chain = new FakeChain(1)
  const base = new FakeChain(8453)
  if (!realChains) setService('chains', fakeChainService({ 1: chain, 8453: base }))
  const app = await buildApp({ logger: false })
  await app.ready()
  shared = { app, chain, base, db, jobs: svc('jobs') }
  return shared
}
export async function teardown() { if (shared) { await shared.app.close(); await pool.end(); shared = null } }

/** Minimal cookie-jar client over fastify.inject. */
export function client(app, { origin } = {}) {
  const jar = {}
  const call = async (method, url, body, headers = {}) => {
    const res = await app.inject({ method, url, payload: body === undefined ? undefined : body, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...headers } })
    for (const c of [].concat(res.headers['set-cookie'] || [])) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v === '' || /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)) delete jar[k]; else jar[k] = v }
    let json = null; try { json = res.json() } catch {}
    return { status: res.statusCode, body: json, raw: res.body, headers: res.headers, data: json?.data, error: json?.error }
  }
  return { get: (u, h) => call('GET', u, undefined, h), post: (u, b = {}, h) => call('POST', u, b, h), patch: (u, b, h) => call('PATCH', u, b, h), del: (u, h) => call('DELETE', u, undefined, h), jar }
}

let n = 0
export async function newUser(app, name = 'User') {
  const c = client(app)
  const email = `${name.toLowerCase().replace(/\W/g, '')}${++n}${Date.now()}@test.example`
  const r = await c.post('/api/v1/auth/register', { name, email, password: 'correct-horse-battery' })
  if (r.status !== 201) throw new Error('register failed ' + JSON.stringify(r.body))
  c.user = r.data.user; c.email = email
  return c
}
export async function newWorkspace(owner, name = 'Test WS') {
  const r = await owner.post('/api/v1/workspaces', { name })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  return r.data.id
}
/** Adds an existing user to a workspace via the real invitation flow. */
export async function addMember(owner, wsId, member, role) {
  const { db } = shared
  const inv = await owner.post(`/api/v1/workspaces/${wsId}/invitations`, { email: member.email, role })
  if (inv.status !== 201) throw new Error(JSON.stringify(inv.body))
  // Retrieve token: the email adapter is "none" in tests, so mint a fresh token on the same invitation row.
  const { secretToken } = await import('../../src/shared/ids.js')
  const { hashToken } = await import('../../src/shared/crypto.js')
  const tok = secretToken()
  await db.q('UPDATE invitations SET token_hash = $1 WHERE id = $2', [hashToken(tok), inv.data.id])
  const r = await member.post('/api/v1/workspaces/invitations/accept', { token: tok })
  if (r.status !== 200) throw new Error(JSON.stringify(r.body))
}
export async function newStaff(app, role = 'super_admin') {
  const secret = newTotpSecret()
  const email = `staff${++n}${Date.now()}@pg.example`
  await shared.db.insert('staff_users', { id: newId('stf'), email, name: 'Staff', passwordHash: await hashPassword('staff-password-123'), roleKey: role, mfaSecretEnc: encrypt(secret), mfaEnabled: true, accessExpiresAt: new Date(Date.now() + 86400_000) })
  const c = client(app)
  const r = await c.post('/api/v1/admin/login', { email, password: 'staff-password-123', otp: totpAt(secret) })
  if (r.status !== 200) throw new Error(JSON.stringify(r.body))
  c.email = email
  return c
}
export const addr = (hex) => '0x' + hex.padStart(40, '0')
export { Wallet }
export const waitJobs = () => shared.jobs.drain()
