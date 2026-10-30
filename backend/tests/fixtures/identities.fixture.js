/**
 * Synthetic Test User Identities for PoisonGuard Testing Suite
 *
 * Isolated identities for automated testing only.
 * Must never use production credentials or real customer emails.
 */

export const TEST_RUN_ID = process.env.TEST_RUN_ID || `E2E_${Date.now()}`
export const TEST_RUN_PREFIX = `POISONGUARD_E2E_${TEST_RUN_ID}`

export const TEST_USERS = {
  pritam: {
    name: 'Pritam Test',
    displayName: 'Pritam',
    role: 'owner',
    email: process.env.TEST_PRITAM_EMAIL || `pritam_${TEST_RUN_ID.toLowerCase()}@poison-guard.test`,
    password: process.env.TEST_PRITAM_PASSWORD || 'PritamGuard_Owner_2026!Sec',
    purpose: 'Workspace owner (can create workspace, invite members, configure policies, manage billing, create agents)',
  },
  stuti: {
    name: 'Stuti Test',
    displayName: 'Stuti',
    role: 'security_manager',
    email: process.env.TEST_STUTI_EMAIL || `stuti_${TEST_RUN_ID.toLowerCase()}@poison-guard.test`,
    password: process.env.TEST_STUTI_PASSWORD || 'StutiGuard_SecMgr_2026!Sec',
    purpose: 'Security manager (can review findings, inspect incidents, review approval requests; no owner-only ops)',
  },
  akash: {
    name: 'Akash Test',
    displayName: 'Akash',
    role: 'developer',
    email: process.env.TEST_AKASH_EMAIL || `akash_${TEST_RUN_ID.toLowerCase()}@poison-guard.test`,
    password: process.env.TEST_AKASH_PASSWORD || 'AkashGuard_Dev_2026!Sec',
    purpose: 'Developer (can view permitted wallet and scan data, create permitted spend intents; cannot change ownership or policies)',
  },
}

export const TEST_ADMIN = {
  name: 'Admin Test Staff',
  displayName: 'Platform Admin',
  role: 'super_admin',
  email: process.env.TEST_ADMIN_EMAIL || `admin_${TEST_RUN_ID.toLowerCase()}@poison-guard.test`,
  password: process.env.TEST_ADMIN_PASSWORD || 'AdminStaff_2026!SuperSec',
}

