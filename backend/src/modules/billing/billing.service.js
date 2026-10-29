import { db, tx } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { audit } from '../audit/audit.service.js'

// Dodo subscription event → our subscription status. Unknown events are recorded and ignored.
const SUB_STATUS = { 'subscription.active': 'active', 'subscription.renewed': 'active', 'subscription.plan_changed': 'active', 'subscription.unpaused': 'active',
  'subscription.on_hold': 'on_hold', 'subscription.past_due': 'past_due', 'subscription.paused': 'on_hold', 'subscription.cancelled': 'cancelled', 'subscription.failed': 'cancelled', 'subscription.expired': 'expired' }

/**
 * Idempotent processing keyed by webhook-id (unique provider_event_id). Out-of-order safe: a status change
 * older than the subscription's last applied event is recorded but not applied.
 */
export async function processDodoEvent(webhookId, event) {
  const evTs = event.timestamp ? new Date(event.timestamp) : new Date()
  const d = event.data || {}
  const workspaceId = d.metadata?.workspace_id || null
  return tx(async (c) => {
    const ins = await c.insert('payment_events', { id: newId('pay'), provider: 'dodo', providerEventId: webhookId, type: event.type, workspaceId, amountCents: Number.isFinite(d.total_amount) ? d.total_amount : null, currency: d.currency ?? null, payload: event, eventTimestamp: evTs },
      { onConflict: 'ON CONFLICT (provider_event_id) DO NOTHING' })
    if (!ins) return { duplicate: true }
    let sub = d.subscription_id ? await c.one('SELECT * FROM subscriptions WHERE provider_subscription_id = $1 FOR UPDATE', [d.subscription_id]) : null
    if (!sub && workspaceId) sub = await c.one('SELECT * FROM subscriptions WHERE workspace_id = $1 FOR UPDATE', [workspaceId])
    if (!sub) { await c.update('payment_events', { id: ins.id }, { status: 'ignored', error: 'No matching workspace/subscription', processedAt: new Date() }); return { ignored: true } }

    let applied = false
    if (SUB_STATUS[event.type]) {
      if (sub.lastEventAt && evTs < new Date(sub.lastEventAt)) {
        await c.update('payment_events', { id: ins.id }, { status: 'ignored', error: 'Out-of-order event older than last applied', processedAt: new Date() })
        return { outOfOrder: true }
      }
      let planKey = sub.planKey
      if (d.product_id) planKey = (await c.one('SELECT key FROM plans WHERE provider_product_id = $1', [d.product_id]))?.key ?? d.metadata?.plan_key ?? planKey
      else if (d.metadata?.plan_key) planKey = d.metadata.plan_key
      const status = SUB_STATUS[event.type]
      await c.update('subscriptions', { id: sub.id }, { status, planKey: ['cancelled', 'expired'].includes(status) ? 'free' : planKey, provider: 'dodo', providerSubscriptionId: d.subscription_id ?? sub.providerSubscriptionId,
        providerCustomerId: d.customer?.customer_id ?? sub.providerCustomerId, currentPeriodEnd: d.next_billing_date ? new Date(d.next_billing_date) : sub.currentPeriodEnd, cancelAtPeriodEnd: !!d.cancel_at_next_billing_date, lastEventAt: evTs })
      applied = true
      await audit(c, { workspaceId: sub.workspaceId, actor: { type: 'system', label: 'billing:dodo' }, action: 'billing.subscription.update', target: { type: 'subscription', id: sub.id }, metadata: { event: event.type, status, planKey, webhookId } })
    }
    await c.update('payment_events', { id: ins.id }, { status: applied || event.type.startsWith('payment.') || event.type.startsWith('refund.') || event.type.startsWith('dispute.') ? 'processed' : 'ignored', workspaceId: sub.workspaceId, processedAt: new Date() })
    return { applied }
  })
}
