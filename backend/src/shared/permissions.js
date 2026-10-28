import { forbidden } from './errors.js'

export const WORKSPACE_ROLES = ['owner', 'admin', 'approver', 'operator', 'auditor']

/** Capability matrix — the single source of truth (mirrors the Guard "Team & roles" matrix). */
const M = {
  'workspace.view':          ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'workspace.settings':      ['owner', 'admin'],
  'workspace.delete':        ['owner'],
  'members.view':            ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'members.manage':          ['owner', 'admin'],
  'wallets.view':            ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'wallets.manage':          ['owner', 'admin', 'operator'],
  'recipients.view':         ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'recipients.manage':       ['owner', 'admin', 'operator'],
  'recipients.verify':       ['owner', 'admin', 'approver'],
  'scans.view':              ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'scans.run':               ['owner', 'admin', 'operator'],
  'agents.view':             ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'agents.manage':           ['owner', 'admin'],
  'agents.freeze':           ['owner', 'admin', 'approver'],
  'intents.view':            ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'intents.create':          ['owner', 'admin', 'operator'],
  'intents.approve':         ['owner', 'admin', 'approver'],
  'intents.execute':         ['owner', 'admin', 'operator'],
  'policies.view':           ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'policies.edit':           ['owner', 'admin'],
  'policies.activate':       ['owner', 'admin'],
  'audit.view':              ['owner', 'admin', 'auditor'],
  'audit.view_own':          ['approver', 'operator'],
  'proofs.view':             ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'proofs.manage':           ['owner', 'admin', 'auditor'],
  'events.view':             ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'events.manage':           ['owner', 'admin'],
  'knowledge.view':          ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'knowledge.manage':        ['owner', 'admin'],
  'assistant.use':           ['owner', 'admin', 'approver', 'operator', 'auditor'],
  'billing.view':            ['owner', 'admin'],
  'billing.manage':          ['owner'],
  'apikeys.manage':          ['owner', 'admin'],
  'webhooks.manage':         ['owner', 'admin'],
  'notifications.view':      ['owner', 'admin', 'approver', 'operator', 'auditor'],
}
export const CAPABILITIES = Object.keys(M)
export const capsForRole = (role) => CAPABILITIES.filter((c) => M[c].includes(role))
export const roleCan = (role, cap) => !!M[cap]?.includes(role)
export function assertCan(membership, cap) {
  if (!membership || !roleCan(membership.role, cap)) throw forbidden(`Your role does not include "${cap}"`)
}

/** Platform staff capabilities. Roles live in platform_staff_roles; these are the defaults seeded. */
export const STAFF_ROLES = {
  super_admin: { name: 'Platform super admin', caps: ['platform.view', 'scans.view', 'scans.retry', 'findings.review', 'reports.review',
    'workspaces.view', 'workspaces.inspect', 'workspaces.suspend', 'access.manage', 'agents.view', 'agents.freeze', 'policies.view',
    'policies.release', 'incidents.view', 'incidents.manage', 'audit.view', 'proofs.view', 'proofs.manage', 'integrations.view',
    'integrations.manage', 'chains.view', 'chains.manage', 'billing.view', 'billing.manage', 'content.view', 'content.publish',
    'flags.view', 'flags.manage', 'settings.view', 'settings.manage', 'users.view', 'notifications.view', 'ai.view', 'ai.manage'] },
  security_reviewer: { name: 'Security reviewer', caps: ['platform.view', 'scans.view', 'scans.retry', 'findings.review', 'reports.review',
    'workspaces.view', 'agents.view', 'agents.freeze', 'policies.view', 'incidents.view', 'incidents.manage', 'audit.view', 'proofs.view',
    'integrations.view', 'chains.view', 'content.view', 'flags.view'] },
  support: { name: 'Support', caps: ['platform.view', 'scans.view', 'reports.review', 'workspaces.view', 'users.view', 'incidents.view', 'notifications.view'] },
  operations: { name: 'Operations', caps: ['platform.view', 'scans.view', 'scans.retry', 'integrations.view', 'integrations.manage', 'chains.view',
    'chains.manage', 'flags.view', 'flags.manage', 'settings.view', 'incidents.view', 'notifications.view', 'ai.view'] },
  billing_ops: { name: 'Billing operations', caps: ['platform.view', 'workspaces.view', 'billing.view', 'billing.manage'] },
}
