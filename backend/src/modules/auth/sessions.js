import { db } from '../../db/index.js'
import { env } from '../../config/env.js'
import { hashToken } from '../../shared/crypto.js'
import { newId, secretToken } from '../../shared/ids.js'
import { USER_COOKIE, STAFF_COOKIE, cookieOpts } from '../../plugins/core.js'

export async function createUserSession(c, reply, req, userId, method = 'password') {
  const token = secretToken('pgs_')
  const ttl = env.SESSION_TTL_HOURS * 3600
  await c.insert('sessions', { id: newId('ses'), tokenHash: hashToken(token), userId, ip: req.ip, userAgent: (req.headers['user-agent'] || '').slice(0, 300), method, expiresAt: new Date(Date.now() + ttl * 1000) })
  reply.setCookie(USER_COOKIE, token, cookieOpts(ttl))
}
export async function createStaffSession(c, reply, req, staffId) {
  const token = secretToken('pgst_')
  const ttl = env.STAFF_SESSION_TTL_HOURS * 3600
  await c.insert('staff_sessions', { id: newId('sts'), tokenHash: hashToken(token), staffId, ip: req.ip, userAgent: (req.headers['user-agent'] || '').slice(0, 300), expiresAt: new Date(Date.now() + ttl * 1000) })
  reply.setCookie(STAFF_COOKIE, token, cookieOpts(ttl))
}
export const revokeAllUserSessions = (c, userId, exceptId = null) =>
  c.q('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND ($2::text IS NULL OR id <> $2)', [userId, exceptId])
