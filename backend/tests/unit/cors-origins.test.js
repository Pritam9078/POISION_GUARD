import test from 'node:test'
import assert from 'node:assert/strict'
import { isOriginAllowed, allowedOrigins } from '../../src/plugins/core.js'

test('CORS & CSRF origin policy validation', async (t) => {
  await t.test('allows PoisonGuard Vercel staging and production deployments', () => {
    assert.equal(isOriginAllowed('https://poisonguard-three.vercel.app'), true)
    assert.equal(isOriginAllowed('https://poisonguard-steel.vercel.app'), true)
    assert.equal(isOriginAllowed('https://poisionguardadmin.vercel.app'), true)
    assert.equal(isOriginAllowed('https://poisonguard.vercel.app'), true)
    assert.equal(isOriginAllowed('https://poisonguard-preview-123.vercel.app/'), true)
  })

  await t.test('allows local development environments', () => {
    assert.equal(isOriginAllowed('http://localhost:5173'), true)
    assert.equal(isOriginAllowed('http://localhost:3000'), true)
    assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true)
    assert.equal(isOriginAllowed('http://127.0.0.1:4000'), true)
  })

  await t.test('allows requests with missing origin (server-to-server, curl, same-origin)', () => {
    assert.equal(isOriginAllowed(null), true)
    assert.equal(isOriginAllowed(undefined), true)
    assert.equal(isOriginAllowed(''), true)
  })

  await t.test('rejects unauthorized foreign domains and spoofed subdomains', () => {
    assert.equal(isOriginAllowed('https://evil.example'), false)
    assert.equal(isOriginAllowed('https://evilpoisonguard.vercel.app'), false)
    assert.equal(isOriginAllowed('https://notpoisonguard.vercel.app'), false)
    assert.equal(isOriginAllowed('https://poisonguard.attacker.com'), false)
    assert.equal(isOriginAllowed('https://attacker.vercel.app'), false)
    assert.equal(isOriginAllowed('javascript:alert(1)'), false)
    assert.equal(isOriginAllowed('not a valid url'), false)
  })
})
