import { db } from '../../db/index.js'
import { decrypt, hmacHex } from '../../shared/crypto.js'
import { env } from '../../config/env.js'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BACKOFF = [30, 120, 600, 1800, 7200, 21600] // seconds
const MAX_ATTEMPTS = BACKOFF.length + 1

const PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd]/i, /^fe80/i, /^::ffff:(10|127|192\.168|169\.254)\./i]
/** SSRF guard: https only, resolves host and rejects private/loopback/link-local targets. */
export async function assertSafeWebhookUrl(raw) {
  let u
  try { u = new URL(raw) } catch { throw Object.assign(new Error('Invalid URL'), { code: 'BAD_URL' }) }
  if (env.WEBHOOK_ALLOW_PRIVATE_URLS) return u
  if (u.protocol !== 'https:') throw Object.assign(new Error('Webhook URLs must use https'), { code: 'BAD_URL' })
  if (u.username || u.password) throw Object.assign(new Error('Credentials in URLs are not allowed'), { code: 'BAD_URL' })
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw Object.assign(new Error('Private hosts are not allowed'), { code: 'BAD_URL' })
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addrs.length) throw Object.assign(new Error('Webhook host does not resolve'), { code: 'BAD_URL' })
  if (addrs.some((a) => PRIVATE.some((re) => re.test(a.address)))) throw Object.assign(new Error('Webhook host resolves to a private address'), { code: 'BAD_URL' })
  return u
}

/**
 * Signature scheme (documented in docs/WEBHOOKS): header `PoisonGuard-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + body)>`.
 * Receivers must reject timestamps older than 5 minutes (replay protection) and dedupe on `PoisonGuard-Event-Id`.
 */
export function signPayload(secret, body, t = Math.floor(Date.now() / 1000)) {
  return { header: `t=${t},v1=${hmacHex(secret, `${t}.${body}`)}`, t }
}

export async function deliverOne(d) {
  const ep = await db.one('SELECT * FROM webhook_endpoints WHERE id = $1', [d.endpointId])
  if (!ep || ep.status !== 'active') { await db.update('webhook_deliveries', { id: d.id }, { status: 'dead', lastError: 'endpoint disabled' }); return }
  const body = JSON.stringify(d.payload)
  const { header } = signPayload(decrypt(ep.secretEnc), body)
  let code = null, err = null
  try {
    await assertSafeWebhookUrl(ep.url)
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 10000)
    const r = await fetch(ep.url, { method: 'POST', redirect: 'manual', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'User-Agent': 'PoisonGuard-Webhooks/1', 'PoisonGuard-Signature': header, 'PoisonGuard-Event-Id': d.eventId, 'PoisonGuard-Event-Type': d.eventType }, body })
    clearTimeout(timer); code = r.status
    if (r.status >= 200 && r.status < 300) { await db.update('webhook_deliveries', { id: d.id }, { status: 'delivered', attempts: d.attempts + 1, lastStatusCode: code, deliveredAt: new Date(), lastError: null }); return }
    err = `HTTP ${r.status}`
  } catch (e) { err = e.message }
  const attempts = d.attempts + 1
  const dead = attempts >= MAX_ATTEMPTS
  await db.update('webhook_deliveries', { id: d.id }, { status: dead ? 'dead' : 'failed', attempts, lastStatusCode: code, lastError: String(err).slice(0, 300), nextAttemptAt: new Date(Date.now() + (BACKOFF[attempts - 1] ?? 0) * 1000) })
}

export async function deliverPending() {
  const due = await db.q(`UPDATE webhook_deliveries SET next_attempt_at = now() + interval '2 minutes' WHERE id IN (
      SELECT id FROM webhook_deliveries WHERE status IN ('pending','failed') AND next_attempt_at <= now() ORDER BY next_attempt_at LIMIT 25 FOR UPDATE SKIP LOCKED) RETURNING *`)
  for (const d of due) await deliverOne(d)
  return { attempted: due.length }
}
