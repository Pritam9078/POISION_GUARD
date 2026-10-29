import { db } from '../../db/index.js'
import { AppError } from '../../shared/errors.js'

const ACTIVE = ['active', 'trialing', 'past_due'] // past_due keeps access during dunning; on_hold/cancelled fall back to free

/** Entitlements come from verified subscription state in the DB — never from client input. */
export async function entitlements(wsId, c = db) {
  const s = await c.one(`SELECT s.plan_key, s.status, p.entitlements FROM subscriptions s JOIN plans p ON p.key = s.plan_key WHERE s.workspace_id = $1`, [wsId])
  if (s && ACTIVE.includes(s.status)) return { plan: s.planKey, status: s.status, ...s.entitlements }
  const free = await c.one(`SELECT entitlements FROM plans WHERE key = 'free'`)
  return { plan: 'free', status: s?.status ?? 'none', ...free.entitlements }
}

const COUNTERS = {
  watchedWallets: (w) => db.one(`SELECT count(*)::int AS n FROM watched_wallets WHERE workspace_id = $1 AND status <> 'removed'`, [w]),
  agents: (w) => db.one(`SELECT count(*)::int AS n FROM agents WHERE workspace_id = $1 AND status <> 'disabled'`, [w]),
  monthlyScans: (w) => db.one(`SELECT count(*)::int AS n FROM scans WHERE workspace_id = $1 AND requested_at >= date_trunc('month', now())`, [w]),
  monthlySpendIntents: (w) => db.one(`SELECT count(*)::int AS n FROM spend_intents WHERE workspace_id = $1 AND created_at >= date_trunc('month', now())`, [w]),
  webhooks: (w) => db.one(`SELECT count(*)::int AS n FROM webhook_endpoints WHERE workspace_id = $1 AND status = 'active'`, [w]),
}
export async function usage(wsId) {
  const out = {}
  for (const [k, f] of Object.entries(COUNTERS)) out[k] = (await f(wsId)).n
  return out
}
export async function assertWithinLimit(wsId, key) {
  const ent = await entitlements(wsId)
  const limit = ent[key]
  if (limit == null) return
  const used = (await COUNTERS[key](wsId)).n
  if (used >= limit) throw new AppError(402, 'PLAN_LIMIT', `Plan "${ent.plan}" allows ${limit} ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}. Upgrade to add more.`)
}
export async function assertFeature(wsId, key) {
  const ent = await entitlements(wsId)
  if (!ent[key]) throw new AppError(402, 'PLAN_FEATURE', `"${key}" is not included in plan "${ent.plan}".`)
}
