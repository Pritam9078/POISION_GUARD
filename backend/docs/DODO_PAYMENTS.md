# Dodo Payments

Verified against Dodo docs (checkout-session and webhooks pages):
- Checkout: `POST https://test.dodopayments.com/checkouts` with `Authorization: Bearer <key>`, body `{ product_cart:[{product_id, quantity}], customer, return_url, metadata }` → `{ session_id, checkout_url }`. Live base URL is assumed `https://live.dodopayments.com` — **confirm before go-live**.
- Webhooks follow **Standard Webhooks**: headers `webhook-id`, `webhook-timestamp`, `webhook-signature` (`v1,<base64>` space-separated); signed content `${id}.${timestamp}.${rawBody}`; HMAC-SHA256 with the base64-decoded secret (strip `whsec_`); 5-minute tolerance. Implemented in `adapters/payments/dodo.js` over the **raw body**.

## Setup
1. Create products in Dodo; set `plans.provider_product_id` for `pro` / `business` (SQL or admin tooling).
2. Set `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENVIRONMENT=test_mode`.
3. Register webhook URL `https://<api>/api/v1/webhooks/dodo`.
4. Enable the `billing` feature flag.

## Processing guarantees
- Idempotent: `payment_events.provider_event_id` (= `webhook-id`) is unique; duplicates return `{duplicate:true}`.
- Out-of-order safe: subscription status changes older than `subscriptions.last_event_at` are recorded and ignored.
- Workspace binding via `metadata.workspace_id` set at checkout, then `provider_subscription_id`.
- Status mapping: `subscription.active|renewed|plan_changed|unpaused → active`, `on_hold|paused → on_hold`, `past_due → past_due`, `cancelled|failed → cancelled`, `expired → expired` (cancelled/expired fall back to the free plan). Payment/refund/dispute events are stored for history.
- **Entitlements are read only from verified DB state** (`modules/billing/entitlements.js`). A redirect to the success page changes nothing.
- Admin can replay a stored, verified event (`POST /admin/billing/events/:id/replay`) after a processing fix.

Tested with locally signed events (valid, invalid signature, duplicate, out-of-order, cancellation). **Not tested against Dodo's sandbox** (no network access during development).
