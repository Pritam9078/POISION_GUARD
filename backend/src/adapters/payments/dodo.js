import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env.js'

// Test base URL verified in Dodo docs (checkout-session page). Live base follows the same pattern — confirm in the API reference before go-live.
export const DODO_BASE = () => (env.DODO_ENVIRONMENT === 'live_mode' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com')
export const dodoConfigured = () => !!env.DODO_API_KEY

/** POST /checkouts — returns { session_id, checkout_url }. Redirect success does NOT prove payment; only verified webhooks do. */
export async function createCheckout({ productId, customerEmail, customerName, workspaceId, planKey, returnUrl }) {
  const r = await fetch(`${DODO_BASE()}/checkouts`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.DODO_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_cart: [{ product_id: productId, quantity: 1 }], customer: { email: customerEmail, name: customerName }, return_url: returnUrl, metadata: { workspace_id: workspaceId, plan_key: planKey } }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Dodo checkout failed: HTTP ${r.status} ${j?.message ?? ''}`.trim())
  return { sessionId: j.session_id, checkoutUrl: j.checkout_url }
}

/**
 * Standard Webhooks verification (as documented by Dodo): signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`,
 * HMAC-SHA256 with base64-decoded secret (strip "whsec_"), header holds space-separated "v1,<base64>" entries.
 */
export function verifyStandardWebhook({ id, timestamp, signature, rawBody, secret = env.DODO_WEBHOOK_SECRET, toleranceSec = 300, now = Date.now() }) {
  if (!secret) return { ok: false, reason: 'webhook secret not configured' }
  if (!id || !timestamp || !signature || rawBody == null) return { ok: false, reason: 'missing webhook headers' }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec) return { ok: false, reason: 'timestamp outside tolerance' }
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest()
  for (const part of String(signature).split(' ')) {
    const [ver, sig] = part.split(',')
    if (ver !== 'v1' || !sig) continue
    const got = Buffer.from(sig, 'base64')
    if (got.length === expected.length && timingSafeEqual(got, expected)) return { ok: true }
  }
  return { ok: false, reason: 'signature mismatch' }
}
