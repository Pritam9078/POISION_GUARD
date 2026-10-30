import { z } from 'zod'
import { db, tx } from '../db/index.js'
import { parse } from '../shared/validate.js'
import { newId } from '../shared/ids.js'
import { requireUser, loadWorkspace } from '../plugins/core.js'
import { audit } from '../modules/audit/audit.service.js'
import { membershipsFor } from '../modules/auth/auth.routes.js'
import { acceptInvitation } from '../modules/workspaces/members.routes.js'

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'workspace'

export default async function workspaceRoutes(app) {
  app.get('/', { preHandler: requireUser }, async (req, reply) => reply.ok({ items: await membershipsFor(req.ctx.user.id) }))

  app.post('/', { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
    const b = parse(z.object({ name: z.string().trim().min(2).max(80) }), req.body)
    const ws = await tx(async (c) => {
      const id = newId('ws')
      const w = await c.insert('workspaces', { id, name: b.name, slug: `${slugify(b.name)}-${id.slice(-6)}` })
      await c.insert('memberships', { id: newId('mem'), workspaceId: id, userId: req.ctx.user.id, role: 'owner' })
      await c.insert('subscriptions', { id: newId('sub'), workspaceId: id, planKey: 'free', status: 'active' })
      await audit(c, { workspaceId: id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'workspace.create', target: { type: 'workspace', id } })
      return w
    })
    return reply.ok({ id: ws.id, workspaceId: ws.id, name: ws.name, slug: ws.slug, role: 'owner' }, {}, 201)
  })

  app.post('/invitations/accept', { preHandler: requireUser }, async (req, reply) => reply.ok(await acceptInvitation(req)))

  // Everything below is tenant-scoped: membership is verified server-side on every request.
  await app.register(async (scoped) => {
    scoped.addHook('preHandler', loadWorkspace)
    for (const mod of ['workspaces/workspace.routes.js', 'workspaces/members.routes.js', 'wallets/wallets.routes.js', 'recipients/recipients.routes.js',
      'scanner/guard-scans.routes.js', 'agents/agents.routes.js', 'policies/policies.routes.js', 'intents/intents.routes.js', 'audit/audit.routes.js',
      'incidents/events.routes.js', 'notifications/notifications.routes.js', 'knowledge/knowledge.routes.js', 'billing/billing.routes.js']) {
      await scoped.register((await import(`../modules/${mod}`)).default)
    }
  }, { prefix: '/:workspaceId' })
}
