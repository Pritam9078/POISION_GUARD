import { z } from 'zod'
import { db, tx } from '../../db/index.js'
import { parse, zEmail } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { WORKSPACE_ROLES, CAPABILITIES, capsForRole } from '../../shared/permissions.js'
import { newId, secretToken } from '../../shared/ids.js'
import { hashToken } from '../../shared/crypto.js'
import { notFound, conflict, forbidden, badRequest } from '../../shared/errors.js'
import { audit } from '../audit/audit.service.js'
import { svc } from '../../services/registry.js'
import { env } from '../../config/env.js'

const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })
const titled = (r) => r[0].toUpperCase() + r.slice(1)

async function seatCheck(c, wsId) {
  const ent = (await c.one(`SELECT p.entitlements FROM subscriptions s JOIN plans p ON p.key = s.plan_key WHERE s.workspace_id = $1`, [wsId]))?.entitlements
  if (ent?.seats == null) return
  const used = (await c.one(`SELECT (SELECT count(*) FROM memberships WHERE workspace_id = $1 AND status = 'active') + (SELECT count(*) FROM invitations WHERE workspace_id = $1 AND status = 'pending' AND expires_at > now()) AS n`, [wsId])).n
  if (Number(used) >= ent.seats) throw new (await import('../../shared/errors.js')).AppError(402, 'PLAN_LIMIT', `Your plan includes ${ent.seats} seats. Upgrade to invite more members.`)
}

/** Owners can only be changed by owners; the last active owner can never be removed or demoted. */
async function assertOwnerSafety(c, wsId, target, newRole, actorRole) {
  if ((target.role === 'owner' || newRole === 'owner') && actorRole !== 'owner') throw forbidden('Only an owner can grant or change the owner role')
  if (target.role === 'owner' && newRole !== 'owner') {
    const owners = await c.one(`SELECT count(*)::int AS n FROM memberships WHERE workspace_id = $1 AND role = 'owner' AND status = 'active'`, [wsId])
    if (owners.n <= 1) throw conflict('The last active owner cannot be removed or demoted. Transfer ownership first.', 'LAST_OWNER')
  }
}

export async function acceptInvitation(req) {
  const b = parse(z.object({ token: z.string().min(20).max(200) }), req.body)
  return tx(async (c) => {
    const inv = await c.one(`SELECT * FROM invitations WHERE token_hash = $1 FOR UPDATE`, [hashToken(b.token)])
    if (!inv || inv.status !== 'pending' || new Date(inv.expiresAt) < new Date()) throw badRequest('Invitation is invalid, used or expired')
    if (inv.email !== req.ctx.user.email) throw forbidden('This invitation was issued to a different email address')
    const existing = await c.one('SELECT id, status FROM memberships WHERE workspace_id = $1 AND user_id = $2', [inv.workspaceId, req.ctx.user.id])
    if (existing?.status === 'active') throw conflict('You are already a member of this workspace')
    if (existing) await c.update('memberships', { id: existing.id }, { status: 'active', role: inv.role })
    else await c.insert('memberships', { id: newId('mem'), workspaceId: inv.workspaceId, userId: req.ctx.user.id, role: inv.role })
    await c.update('invitations', { id: inv.id }, { status: 'accepted', acceptedAt: new Date() })
    await audit(c, { workspaceId: inv.workspaceId, actor: actor(req), action: 'membership.join', target: { type: 'invitation', id: inv.id }, metadata: { role: inv.role } })
    return { workspaceId: inv.workspaceId, role: inv.role }
  })
}

export default async function (app) {
  app.get('/roles', { preHandler: can('members.view') }, async (req, reply) => {
    reply.ok({ roles: WORKSPACE_ROLES, matrix: CAPABILITIES.map((cap) => ({ capability: cap, ...Object.fromEntries(WORKSPACE_ROLES.map((r) => [titled(r), capsForRole(r).includes(cap)])) })) })
  })

  app.get('/members', { preHandler: can('members.view') }, async (req, reply) => {
    const rows = await db.q(`SELECT m.id, m.user_id, m.role, m.status, m.expires_at, m.created_at AS joined_at, u.name, u.email,
      (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_active
      FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 AND m.status <> 'removed' ORDER BY m.created_at`, [req.ws.id])
    reply.ok({ items: rows.map((r) => ({ ...r, roleLabel: titled(r.role) })) })
  })

  app.patch('/members/:memberId', { preHandler: can('members.manage') }, async (req, reply) => {
    const b = parse(z.object({ role: z.enum(WORKSPACE_ROLES).optional(), status: z.enum(['active', 'suspended']).optional(), expiresAt: z.string().datetime().nullable().optional() }), req.body)
    const row = await tx(async (c) => {
      const m = await c.one(`SELECT * FROM memberships WHERE id = $1 AND workspace_id = $2 AND status <> 'removed' FOR UPDATE`, [req.params.memberId, req.ws.id])
      if (!m) throw notFound('Member')
      if (b.role || b.status === 'suspended') await assertOwnerSafety(c, req.ws.id, m, b.status === 'suspended' ? 'suspended' : b.role, req.ws.membership.role)
      if (m.userId === req.ctx.user.id && b.role && b.role !== m.role) throw forbidden('You cannot change your own role')
      const r = await c.update('memberships', { id: m.id }, { role: b.role, status: b.status, expiresAt: b.expiresAt === undefined ? undefined : b.expiresAt && new Date(b.expiresAt) })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'membership.update', target: { type: 'membership', id: m.id }, metadata: { from: { role: m.role, status: m.status }, to: b } })
      return r
    })
    reply.ok(row)
  })

  app.delete('/members/:memberId', { preHandler: can('members.manage') }, async (req, reply) => {
    await tx(async (c) => {
      const m = await c.one(`SELECT * FROM memberships WHERE id = $1 AND workspace_id = $2 AND status <> 'removed' FOR UPDATE`, [req.params.memberId, req.ws.id])
      if (!m) throw notFound('Member')
      await assertOwnerSafety(c, req.ws.id, m, 'removed', req.ws.membership.role)
      await c.update('memberships', { id: m.id }, { status: 'removed' })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'membership.remove', target: { type: 'membership', id: m.id }, metadata: { userId: m.userId, role: m.role } })
    })
    reply.ok({ removed: true })
  })

  app.get('/invitations', { preHandler: can('members.view') }, async (req, reply) => {
    await db.q(`UPDATE invitations SET status = 'expired' WHERE workspace_id = $1 AND status = 'pending' AND expires_at < now()`, [req.ws.id])
    reply.ok({ items: await db.q(`SELECT i.id, i.email, i.role, i.status, i.expires_at, i.created_at AS invited_at, u.name AS invited_by FROM invitations i LEFT JOIN users u ON u.id = i.invited_by_id WHERE i.workspace_id = $1 ORDER BY i.created_at DESC`, [req.ws.id]) })
  })

  app.post('/invitations', { preHandler: can('members.manage'), config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (req, reply) => {
    const b = parse(z.object({ email: zEmail, role: z.enum(WORKSPACE_ROLES), message: z.string().max(500).optional(), expiresInDays: z.number().int().min(1).max(30).default(7) }), req.body)
    if (b.role === 'owner' && req.ws.membership.role !== 'owner') throw forbidden('Only owners can invite owners')
    const token = secretToken()
    const inv = await tx(async (c) => {
      const already = await c.one(`SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 AND u.email = $2 AND m.status = 'active'`, [req.ws.id, b.email])
      if (already) throw conflict('That person is already a member')
      await seatCheck(c, req.ws.id)
      await c.q(`UPDATE invitations SET status = 'revoked' WHERE workspace_id = $1 AND email = $2 AND status = 'pending'`, [req.ws.id, b.email])
      const r = await c.insert('invitations', { id: newId('inv'), workspaceId: req.ws.id, email: b.email, role: b.role, tokenHash: hashToken(token), message: b.message ?? null, invitedById: req.ctx.user.id, expiresAt: new Date(Date.now() + b.expiresInDays * 86400_000) })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'invitation.create', target: { type: 'invitation', id: r.id }, metadata: { email: b.email, role: b.role } })
      return r
    })
    await svc('email').send({ to: b.email, subject: `You're invited to ${req.ws.name} on PoisonGuard`, text: `${req.ctx.user.name} invited you as ${b.role}.${b.message ? '\n\n' + b.message : ''}\n\nAccept: ${env.FRONTEND_URL}/guard/invite?token=${token}` })
    reply.ok({ id: inv.id, email: inv.email, role: inv.role, status: inv.status, expiresAt: inv.expiresAt }, {}, 201)
  })

  app.delete('/invitations/:invId', { preHandler: can('members.manage') }, async (req, reply) => {
    const r = await db.one(`UPDATE invitations SET status = 'revoked' WHERE id = $1 AND workspace_id = $2 AND status = 'pending' RETURNING id`, [req.params.invId, req.ws.id])
    if (!r) throw notFound('Pending invitation')
    await audit(null, { workspaceId: req.ws.id, actor: actor(req), action: 'invitation.revoke', target: { type: 'invitation', id: r.id } })
    reply.ok({ revoked: true })
  })

  app.get('/access-review', { preHandler: can('members.manage') }, async (req, reply) => {
    const rows = await db.q(`SELECT m.id, u.name, u.email, m.role, m.status, m.expires_at, m.created_at,
      (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_active
      FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 AND m.status = 'active'`, [req.ws.id])
    const stale = Date.now() - 90 * 86400_000
    reply.ok({ items: rows.map((r) => ({ ...r, flags: [...(!r.lastActive || new Date(r.lastActive).getTime() < stale ? ['inactive_90d'] : []), ...(['owner', 'admin'].includes(r.role) ? ['privileged'] : []), ...(r.expiresAt ? ['time_bound'] : [])] })) })
  })
}
