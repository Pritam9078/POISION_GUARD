import '../helpers/env.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate, validatePolicyConfig } from '../../src/modules/policies/engine.js'

const TO = '0x' + '1'.repeat(40), USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const intent = (o = {}) => ({ walletId: 'w1', agentId: null, chainId: 1, toAddress: TO, assetType: 'erc20', tokenAddress: USDC, amount: '1000', ...o })
const pol = (cfg) => { const v = validatePolicyConfig(cfg); assert.ok(v.ok, v.errors?.join()); return { policyId: 'p', name: 'P', versionId: 'v', version: 1, config: v.config } }
const ctx = (o = {}) => ({ trusted: [], recipientFindings: [], lookalikeOfTrusted: [], intelligenceAvailable: true, spent: () => 0n, now: new Date('2026-10-27T15:00:00Z'), ...o })

test('allow when all rules pass and zero approvals required', () => {
  const r = evaluate(intent(), [pol({ recipients: { mode: 'any', untrusted: 'allow' }, approvals: { required: 0 } })], ctx())
  assert.equal(r.decision, 'allow')
})
test('no applicable policy defaults to one human approval', () => {
  const r = evaluate(intent(), [], ctx())
  assert.equal(r.decision, 'require_approval'); assert.equal(r.requiredApprovals, 1); assert.ok(r.reasonCodes.includes('NO_POLICY_DEFAULT_REVIEW'))
})
test('deny beats require_approval; per-tx limit enforced in base units', () => {
  const r = evaluate(intent({ amount: '5001' }), [pol({ limits: [{ asset: USDC, chainId: 1, perTx: '5000' }], approvals: { required: 2 } })], ctx())
  assert.equal(r.decision, 'deny'); assert.ok(r.reasonCodes.includes('PER_TX_LIMIT')); assert.equal(r.requiredApprovals, 0)
})
test('trusted recipient does NOT override poisoning evidence', () => {
  const r = evaluate(intent(), [pol({ recipients: { mode: 'allowlist' }, approvals: { required: 0 } })], ctx({ trusted: [{ address: TO, label: 'Vault' }], recipientFindings: [{ ruleId: 'PG-POISON-001', severity: 'high' }] }))
  assert.equal(r.decision, 'deny'); assert.ok(r.reasonCodes.includes('RECIPIENT_POISONING_EVIDENCE'))
})
test('lookalike of trusted recipient is denied', () => {
  const r = evaluate(intent(), [pol({ approvals: { required: 0 } })], ctx({ lookalikeOfTrusted: [{ address: '0x' + '2'.repeat(40), label: 'Vault' }] }))
  assert.equal(r.decision, 'deny')
})
test('blocklist denies even trusted recipients', () => {
  const r = evaluate(intent(), [pol({ recipients: { blocked: [TO] }, approvals: { required: 0 } })], ctx({ trusted: [{ address: TO, label: 'X' }] }))
  assert.ok(r.reasonCodes.includes('RECIPIENT_BLOCKED'))
})
test('period limit accounts for committed spend', () => {
  const p = pol({ limits: [{ asset: USDC, chainId: 1, perPeriod: '1500', periodHours: 24 }], approvals: { required: 0 }, recipients: { untrusted: 'allow' } })
  assert.equal(evaluate(intent(), [p], ctx({ spent: () => 400n })).decision, 'allow')
  assert.equal(evaluate(intent(), [p], ctx({ spent: () => 600n })).decision, 'deny')
})
test('approval thresholds raise required approvals', () => {
  const p = pol({ approvals: { required: 1, thresholds: [{ asset: USDC, chainId: 1, atOrAbove: '1000', required: 2 }] } })
  assert.equal(evaluate(intent(), [p], ctx()).requiredApprovals, 2)
  assert.equal(evaluate(intent({ amount: '999' }), [p], ctx()).requiredApprovals, 1)
})
test('intelligence unavailable follows configured behavior', () => {
  assert.equal(evaluate(intent(), [pol({ intelligenceUnavailable: 'deny', approvals: { required: 0 }, recipients: { untrusted: 'allow' } })], ctx({ intelligenceAvailable: false })).decision, 'deny')
})
test('time window', () => {
  const p = pol({ timeWindow: { days: [2], startHourUtc: 14, endHourUtc: 16 }, approvals: { required: 0 }, recipients: { untrusted: 'allow' } })
  assert.equal(evaluate(intent(), [p], ctx({ now: new Date('2026-10-27T15:00:00Z') })).decision, 'allow') // Tuesday
  assert.equal(evaluate(intent(), [p], ctx({ now: new Date('2026-10-28T15:00:00Z') })).decision, 'deny')
})
test('agent guardrails: asset without explicit limit is denied; frozen agent denied', () => {
  const agent = { id: 'a', name: 'bot', status: 'active', allowedChains: [1], controlledWalletIds: ['w1'], perTxLimits: [{ asset: 'native', chainId: 1, amount: '10' }], periodLimits: [], periodHours: 24, approvalThreshold: [], expiresAt: '2099-01-01' }
  assert.ok(evaluate(intent({ agentId: 'a' }), [], ctx({ agent })).reasonCodes.includes('AGENT_ASSET_NOT_PERMITTED'))
  assert.ok(evaluate(intent({ agentId: 'a', assetType: 'native', tokenAddress: null, amount: '5' }), [], ctx({ agent: { ...agent, status: 'frozen' } })).reasonCodes.includes('AGENT_NOT_ACTIVE'))
  assert.ok(evaluate(intent({ agentId: 'a', walletId: 'w2', assetType: 'native', tokenAddress: null, amount: '5' }), [], ctx({ agent })).reasonCodes.includes('AGENT_WALLET_NOT_ALLOWED'))
})
test('policy validation rejects malformed config', () => {
  assert.equal(validatePolicyConfig({ limits: [{ asset: 'native', chainId: 1 }] }).ok, false)
  assert.equal(validatePolicyConfig({ unknownKey: 1 }).ok, false)
  assert.equal(validatePolicyConfig({ recipients: { mode: 'allowlist', untrusted: 'allow' } }).ok, false)
})
