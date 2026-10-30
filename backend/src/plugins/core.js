import fp from 'fastify-plugin'
import { randomUUID } from 'node:crypto'
import { AppError, unauthorized, forbidden, notFound } from '../shared/errors.js'
import { env } from '../config/env.js'
import { db } from '../db/index.js'
import { hashToken, sha256 } from '../shared/crypto.js'
import { assertCan } from '../shared/permissions.js'

export const USER_COOKIE = 'pg_sid'
export const STAFF_COOKIE = 'pg_staff_sid'

export const allowedOrigins = () => (env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : [env.FRONTEND_URL, env.ADMIN_URL])

export const cookieOpts = (maxAgeSec) => ({ path: '/', httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, maxAge: maxAgeSec })

async function core(app) {
  app.decorateRequest('ctx', null)
  app.decorateReply('ok', function ok(data, meta = {}, status = 200) {
    return this.code(status).send({ success: true, data, meta: { requestId: this.request.id, ...meta } })
  })

  app.addHook('onRequest', async (req) => {
    req.ctx = { requestId: req.id, ip: req.ip, ipHash: sha256('ip:' + req.ip + env.SESSION_SECRET).slice(0, 32), user: null, session: null, staff: null, staffSession: null, agent: null }

    // CSRF defence for cookie auth: browsers always send Origin on cross-site state-changing requests.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin
      if (origin && !allowedOrigins().includes(origin) && !req.url.startsWith('/api/v1/webhooks/') && !req.url.startsWith('/api/v1/agent/')) {
        throw new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed')
      }
    }

    const ut = req.cookies?.[USER_COOKIE]
    if (ut) {
      const s = await db.one(`SELECT s.*, u.email, u.name, u.status AS user_status, u.email_verified_at FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [hashToken(ut)])
      if (s && s.userStatus === 'active') {
        req.ctx.session = { id: s.id, method: s.method, createdAt: s.createdAt }
        req.ctx.user = { id: s.userId, email: s.email, name: s.name, emailVerified: !!s.emailVerifiedAt }
        if (Date.now() - new Date(s.lastSeenAt).getTime() > 5 * 60_000) db.q('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [s.id]).catch(() => {})
      }
    }
    const st = req.cookies?.[STAFF_COOKIE]
    if (st && req.url.startsWith('/api/v1/admin')) {
      const s = await db.one(`SELECT ss.id AS session_id, su.*, r.capabilities FROM staff_sessions ss JOIN staff_users su ON su.id = ss.staff_id
        JOIN platform_staff_roles r ON r.key = su.role_key
        WHERE ss.token_hash = $1 AND ss.revoked_at IS NULL AND ss.expires_at > now()`, [hashToken(st)])
      if (s && s.status === 'active' && (!s.accessExpiresAt || new Date(s.accessExpiresAt) > new Date())) {
        req.ctx.staffSession = { id: s.sessionId }
        req.ctx.staff = { id: s.id, email: s.email, name: s.name, role: s.roleKey, capabilities: s.capabilities, scopes: s.scopes }
      }
    }
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ success: false, error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }, meta: { requestId: req.id } })
    }
    if (err.statusCode === 429) return reply.code(429).send({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests — retry shortly.' }, meta: { requestId: req.id } })
    if (err.validation || err.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || err.code === 'FST_ERR_CTP_EMPTY_JSON_BODY' || (err.statusCode === 400 && err.code?.startsWith('FST_'))) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message }, meta: { requestId: req.id } })
    }
    if (err.statusCode === 413) return reply.code(413).send({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' }, meta: { requestId: req.id } })
    req.log.error({ err }, 'unhandled error')
    return reply.code(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred. Reference the request id when contacting support.' }, meta: { requestId: req.id } })
  })
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: `No route ${req.method} ${req.url.split('?')[0]}` }, meta: { requestId: req.id } }))
}
export default fp(core)

// ── guards used as preHandlers ──
export async function requireUser(req) { if (!req.ctx.user) throw unauthorized() }
export const requireStaff = (cap) => async (req) => {
  if (!req.ctx.staff) throw unauthorized('Platform staff sign-in required')
  if (cap && !req.ctx.staff.capabilities.includes(cap)) throw forbidden(`Staff role lacks "${cap}"`)
}
/** Loads :workspaceId membership for the signed-in user. Never trusts a client-supplied workspace id on its own. */
export async function loadWorkspace(req) {
  if (!req.ctx.user) throw unauthorized()
  const wid = req.params.workspaceId
  const m = await db.one(`SELECT m.*, w.name AS workspace_name, w.status AS workspace_status, w.settings AS workspace_settings
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.workspace_id = $1 AND m.user_id = $2 AND m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > now())`, [wid, req.ctx.user.id])
  if (!m) throw notFound('Workspace') // indistinguishable from non-existent: no tenant enumeration
  if (m.workspaceStatus !== 'active' && !['GET', 'HEAD'].includes(req.method)) throw new AppError(403, 'WORKSPACE_SUSPENDED', 'This workspace is suspended by the platform; it is read-only.')
  req.ws = { id: wid, name: m.workspaceName, settings: m.workspaceSettings, membership: { id: m.id, role: m.role, userId: m.userId, scope: m.scope } }
}
export const can = (cap) => async (req) => assertCan(req.ws?.membership, cap)
