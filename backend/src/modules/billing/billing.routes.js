import { z } from 'zod'
import { db } from '../../db/index.js'
import { parse } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { AppError, unavailable } from '../../shared/errors.js'
import { entitlements, usage } from './entitlements.js'
import { createCheckout, dodoConfigured } from '../../adapters/payments/dodo.js'
import { audit } from '../audit/audit.service.js'
import { env } from '../../config/env.js'
import { flagEnabled } from '../flags/flags.js'

export default async function (app) {
  app.get('/billing', { preHandler: can('billing.view') }, async (req, reply) => {
    const [sub, ent, use, plans, events] = await Promise.all([
      db.one('SELECT s.*, p.name AS plan_name, p.price_monthly_cents, p.currency FROM subscriptions s JOIN plans p ON p.key = s.plan_key WHERE s.workspace_id = $1', [req.ws.id]),
      entitlements(req.ws.id), usage(req.ws.id), db.q('SELECT key, name, price_monthly_cents, currency, entitlements, provider_product_id IS NOT NULL AS purchasable FROM plans WHERE active ORDER BY price_monthly_cents'),
      db.q(`SELECT id, type, amount_cents, currency, status, event_timestamp, received_at FROM payment_events WHERE workspace_id = $1 AND (type LIKE 'payment.%' OR type LIKE 'refund.%') ORDER BY received_at DESC LIMIT 50`, [req.ws.id]),
    ])
    const seatsUsed = (await db.one(`SELECT count(*)::int AS n FROM memberships WHERE workspace_id = $1 AND status = 'active'`, [req.ws.id])).n
    reply.ok({
      plan: sub?.planName, planKey: sub?.planKey, status: sub?.status, renewsAt: sub?.currentPeriodEnd, cancelAtPeriodEnd: sub?.cancelAtPeriodEnd, priceMonthly: sub ? sub.priceMonthlyCents / 100 : 0, currency: sub?.currency,
      seats: ent.seats, seatsUsed, entitlements: ent,
      usage: [['Scans this month', use.monthlyScans, ent.monthlyScans], ['Watched wallets', use.watchedWallets, ent.watchedWallets], ['Agents', use.agents, ent.agents], ['Spend intents this month', use.monthlySpendIntents, ent.monthlySpendIntents], ['Webhooks', use.webhooks, ent.webhooks]].map(([metric, used, quota]) => ({ metric, used, quota })),
      payments: events, plans, provider: { name: 'Dodo Payments', configured: dodoConfigured(), environment: env.DODO_ENVIRONMENT },
      note: 'Entitlements reflect verified provider webhook events only. A checkout redirect alone does not change your plan.',
    })
  })

  app.post('/billing/checkout', { preHandler: can('billing.manage') }, async (req, reply) => {
    const b = parse(z.object({ planKey: z.enum(['pro', 'business']) }), req.body)
    if (!(await flagEnabled('billing', { workspaceId: req.ws.id }))) throw new AppError(503, 'FEATURE_DISABLED', 'Self-serve billing is not enabled yet')
    if (!dodoConfigured()) throw unavailable('Payment provider is not configured', 'PAYMENTS_NOT_CONFIGURED')
    const plan = await db.one('SELECT * FROM plans WHERE key = $1 AND active', [b.planKey])
    if (!plan?.providerProductId) throw unavailable(`Plan "${b.planKey}" has no provider product mapping`, 'PLAN_NOT_PURCHASABLE')
    const out = await createCheckout({ productId: plan.providerProductId, customerEmail: req.ctx.user.email, customerName: req.ctx.user.name, workspaceId: req.ws.id, planKey: b.planKey, returnUrl: env.DODO_RETURN_URL || `${env.FRONTEND_URL}/guard/billing?checkout=return` })
    await audit(null, { workspaceId: req.ws.id, actor: { type: 'user', id: req.ctx.user.id, label: req.ctx.user.name }, action: 'billing.checkout.create', metadata: { planKey: b.planKey, sessionId: out.sessionId } })
    reply.ok({ ...out, note: 'Your plan changes after Dodo confirms the payment via a signed webhook.' }, {}, 201)
  })
}
