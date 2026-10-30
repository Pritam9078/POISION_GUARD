import { query } from '../helpers/db.helper.js'
import { hashPassword } from '../../src/shared/crypto.js'
import { newId } from '../../src/shared/ids.js'

export async function createTestUser({
  name = 'Test User',
  email,
  password = 'TestPassword123!',
  role = 'owner',
  status = 'active',
  emailVerified = true,
} = {}) {
  const userId = newId('usr')
  const passwordHash = await hashPassword(password)
  const userRes = await query(
    `INSERT INTO users (id, email, name, password_hash, email_verified, status, failed_logins, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, now(), now())
     RETURNING id, email, name, email_verified, status`,
    [userId, email.toLowerCase(), name, passwordHash, emailVerified, status]
  )
  return {
    ...userRes.rows[0],
    password,
  }
}

export async function createTestStaffUser({
  name = 'Staff Admin',
  email,
  password = 'StaffPassword123!',
  roleKey = 'super_admin',
  status = 'active',
} = {}) {
  const staffId = newId('stf')
  const passwordHash = await hashPassword(password)
  const scopes = [
    'platform.view', 'platform.manage',
    'scans.view', 'scans.manage', 'scans.retry',
    'integrations.view', 'integrations.manage',
    'knowledge.manage', 'reports.view', 'reports.manage',
    'incidents.manage', 'staff.manage'
  ]
  const staffRes = await query(
    `INSERT INTO staff_users (id, email, name, role_key, scopes, password_hash, status, mfa_required, mfa_enabled, failed_logins, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, false, 0, now(), now())
     ON CONFLICT (email) DO UPDATE SET password_hash = $6, status = $7, failed_logins = 0, locked_until = null
     RETURNING id, email, name, role_key, status`,
    [staffId, email.toLowerCase(), name, roleKey, scopes, passwordHash, status]
  )
  return {
    ...staffRes.rows[0],
    password,
  }
}
