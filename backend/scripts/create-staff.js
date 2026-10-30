/** Provision a platform staff account with MFA. Usage: node scripts/create-staff.js email "Name" role [password] */
import { runMigrations } from '../src/db/migrate.js'
import { seedReference } from '../src/db/seed-reference.js'
import { db, pool } from '../src/db/index.js'
import { hashPassword, newTotpSecret, encrypt } from '../src/shared/crypto.js'
import { newId, randomString } from '../src/shared/ids.js'
import { audit } from '../src/modules/audit/audit.service.js'

const [email, name, role = 'super_admin', pw] = process.argv.slice(2)
if (!email || !name) { console.error('Usage: node scripts/create-staff.js <email> "<name>" [role] [password]'); process.exit(1) }
await runMigrations(() => {}); await seedReference()
const password = pw || randomString(20)
const secret = newTotpSecret()
await db.insert('staff_users', { id: newId('stf'), email: email.toLowerCase(), name, passwordHash: await hashPassword(password), roleKey: role, mfaSecretEnc: encrypt(secret), mfaEnabled: true, accessExpiresAt: new Date(Date.now() + 90 * 86400_000), justification: 'Provisioned via CLI' })
await audit(null, { actor: { type: 'system', label: 'cli:create-staff' }, action: 'admin.access.provision', metadata: { email, role } })
console.log(JSON.stringify({ email, role, password, totpSecret: secret, otpauth: `otpauth://totp/PoisonGuard:${encodeURIComponent(email)}?secret=${secret}&issuer=PoisonGuard`, accessExpires: '90 days' }, null, 2))
console.log('\nStore the password and TOTP secret now; they are not shown again.')
await pool.end()
