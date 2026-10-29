import { db } from '../../db/index.js'
/** Feature flags gate rollout only. They never bypass authentication, authorization or safety validators. */
export async function flagEnabled(key, { workspaceId } = {}) {
  const f = await db.one('SELECT enabled, rollout_scope, expires_at FROM feature_flags WHERE key = $1', [key])
  if (!f || !f.enabled || (f.expiresAt && new Date(f.expiresAt) < new Date())) return false
  if (f.rolloutScope === 'all') return true
  if (f.rolloutScope.startsWith('workspaces:')) return !!workspaceId && f.rolloutScope.slice(11).split(',').includes(workspaceId)
  return false
}
