import '../helpers/env.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { hashPassword, verifyPassword, encrypt, decrypt, newTotpSecret, totpAt, verifyTotp, canonicalJson, hmacHex } from '../../src/shared/crypto.js'
import { verifyStandardWebhook } from '../../src/adapters/payments/dodo.js'
import { signPayload, assertSafeWebhookUrl } from '../../src/modules/notifications/webhooks.service.js'
import { chunkText, routeQuery } from '../../src/modules/knowledge/knowledge.service.js'

test('scrypt password hashing', async () => {
  const h = await hashPassword('pw-123456789')
  assert.ok(await verifyPassword('pw-123456789', h)); assert.ok(!(await verifyPassword('nope', h)))
})
test('AES-GCM round trip and tamper detection', () => {
  const c = encrypt('secret'); assert.equal(decrypt(c), 'secret')
  const parts = c.split('.'); parts[3] = Buffer.from('x').toString('base64')
  assert.throws(() => decrypt(parts.join('.')))
})
test('TOTP', () => { const s = newTotpSecret(); assert.ok(verifyTotp(s, totpAt(s))); assert.ok(!verifyTotp(s, '000000') || totpAt(s) === '000000') })
test('canonical JSON is key-order independent', () => assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 })))

test('Standard Webhooks (Dodo) verification', () => {
  const secret = process.env.DODO_WEBHOOK_SECRET, key = Buffer.from(secret.slice(6), 'base64')
  const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000)), body = '{"type":"payment.succeeded"}'
  const sig = 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  assert.ok(verifyStandardWebhook({ id, timestamp: ts, signature: `v1,bogus ${sig}`, rawBody: body }).ok)
  assert.ok(!verifyStandardWebhook({ id, timestamp: ts, signature: sig, rawBody: body + ' ' }).ok)
  assert.ok(!verifyStandardWebhook({ id, timestamp: String(Number(ts) - 3600), signature: sig, rawBody: body }).ok)
})
test('outbound webhook signature', () => {
  const { header, t } = signPayload('whsec_x', '{"a":1}', 1700000000)
  assert.equal(header, `t=${t},v1=${hmacHex('whsec_x', `${t}.{"a":1}`)}`)
})
test('webhook SSRF guard', async () => {
  for (const u of ['http://example.com/hook', 'https://127.0.0.1/x', 'https://10.1.2.3/x', 'https://localhost/x', 'https://user:pw@example.com/']) await assert.rejects(assertSafeWebhookUrl(u))
})
test('chunking is structure aware', () => {
  const ch = chunkText('# Alpha\npara one\n\n# Beta\n' + 'x '.repeat(800))
  assert.equal(ch[0].section, 'Alpha'); assert.ok(ch.filter((c) => c.section === 'Beta').length >= 2)
})
test('assistant router refuses action requests', () => {
  assert.equal(routeQuery('please approve the pending intent'), 'action_request')
  assert.equal(routeQuery('sign this transaction for me'), 'action_request')
  assert.equal(routeQuery('what is my current USDC allowance'), 'live_blockchain')
  assert.equal(routeQuery('what is address poisoning?'), 'security_knowledge')
})
