/**
 * DEVELOPMENT SEED — creates a clearly-labelled demo account and workspace. Refuses to run in production.
 * It does NOT fabricate scans, findings or chain data: run real scans against a configured RPC/testnet.
 */
import { env } from '../src/config/env.js'
import { runMigrations } from '../src/db/migrate.js'
import { seedReference } from '../src/db/seed-reference.js'
import { db, tx, pool } from '../src/db/index.js'
import { hashPassword } from '../src/shared/crypto.js'
import { newId } from '../src/shared/ids.js'
import { validatePolicyConfig } from '../src/modules/policies/engine.js'

if (env.NODE_ENV === 'production') { console.error('Refusing to seed demo data in production'); process.exit(1) }
await runMigrations(() => {}); await seedReference()
const email = 'demo.owner@poisonguard.local', password = 'demo-password-change-me'
if (await db.one('SELECT id FROM users WHERE email = $1', [email])) { console.log('Demo seed already present'); await pool.end(); process.exit(0) }
await tx(async (c) => {
  const u = await c.insert('users', { id: newId('usr'), email, name: '[DEV SEED] Demo Owner', passwordHash: await hashPassword(password), emailVerifiedAt: new Date() })
  const ws = await c.insert('workspaces', { id: newId('ws'), name: '[DEV SEED] Demo Workspace', slug: 'dev-seed-demo' })
  await c.insert('memberships', { id: newId('mem'), workspaceId: ws.id, userId: u.id, role: 'owner' })
  await c.insert('subscriptions', { id: newId('sub'), workspaceId: ws.id, planKey: 'free', status: 'active' })
  const cfg = validatePolicyConfig({ recipients: { mode: 'allowlist', untrusted: 'require_approval' }, approvals: { required: 1 } }).config
  const p = await c.insert('policies', { id: newId('pol'), workspaceId: ws.id, name: '[DEV SEED] Default guardrails', description: 'Allowlist + one approver', status: 'draft', createdById: u.id, updatedById: u.id })
  await c.insert('policy_versions', { id: newId('pov'), policyId: p.id, version: 1, config: JSON.stringify(cfg), changeNote: 'Dev seed draft (simulate, then activate)', createdById: u.id })
})
console.log(JSON.stringify({ email, password, note: 'Dev-only account. Policy is a draft: run the simulator, then activate it.' }, null, 2))
await pool.end()
