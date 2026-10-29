import '../helpers/env.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runRules, aggregate, similarity, prefixLen, suffixLen } from '../../src/modules/scanner/rules.js'

const S = '0x7a9e4f3b1c2d5e6f8091a2b3c4d5e6f708192a3b'
const LEGIT = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
const LOOK = '0xd8da6bf2000000000000000000000000aa96045' .padEnd(42, '0').slice(0, 42)
const lookalike = '0xd8da' + 'f'.repeat(32) + '6045' // shares 4 prefix + 4 suffix with LEGIT
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const meta = { [USDC]: { symbol: 'USDC', decimals: 6 } }
const t = (o) => ({ chainId: 1, kind: 'erc20', token: USDC, logIndex: 0, blockNumber: 100n, txHash: '0x' + 'a'.repeat(64), timestamp: null, txFrom: null, ...o })

test('similarity measures prefix/suffix hex', () => {
  assert.equal(prefixLen(LEGIT, lookalike), 4)
  assert.equal(suffixLen(LEGIT, lookalike), 4)
  assert.equal(similarity(LEGIT, lookalike).strength, 'strong')
  assert.equal(similarity(LEGIT, LEGIT).strength, null)
  assert.equal(similarity(LEGIT, '0x' + '1'.repeat(40)).strength, null)
})

test('PG-POISON-001 flags a lookalike of an established counterparty', () => {
  const transfers = [t({ from: S, to: LEGIT, value: '5000000000', txFrom: S }), t({ from: lookalike, to: S, value: '0', txHash: '0x' + 'b'.repeat(64) })]
  const f = runRules({ subject: S, chainId: 1, transfers, tokenMeta: meta })
  const p = f.find((x) => x.ruleId === 'PG-POISON-001')
  assert.ok(p, 'expected lookalike finding')
  assert.equal(p.severity, 'high')
  assert.equal(p.relatedAddress, lookalike)
  assert.ok(p.evidence.some((e) => e.kind === 'onchain_fact' && e.txHash === '0x' + 'b'.repeat(64)))
  assert.ok(p.evidence.some((e) => e.kind === 'interpretation'))
})

test('PG-POISON-001 does not fire on string similarity without an established counterparty', () => {
  const transfers = [t({ from: lookalike, to: S, value: '0' }), t({ from: LEGIT, to: S, value: '0' })]
  assert.equal(runRules({ subject: S, chainId: 1, transfers, tokenMeta: meta }).filter((x) => x.ruleId === 'PG-POISON-001').length, 0)
})

test('PG-POISON-001 uses workspace trusted recipients as established', () => {
  const transfers = [t({ from: lookalike, to: S, value: '0' })]
  const f = runRules({ subject: S, chainId: 1, transfers, tokenMeta: meta, trusted: [{ address: LEGIT, label: 'Vault' }] })
  assert.ok(f.find((x) => x.ruleId === 'PG-POISON-001'))
})

test('PG-POISON-002 detects zero-value transfer spoofed by a third party', () => {
  const transfers = [t({ from: S, to: lookalike, value: '0', txFrom: '0x' + '9'.repeat(40) })]
  const f = runRules({ subject: S, chainId: 1, transfers, tokenMeta: meta })
  const s = f.find((x) => x.ruleId === 'PG-POISON-002')
  assert.ok(s); assert.equal(s.confidence, 85)
})

test('PG-POISON-003 requires several distinct dust senders', () => {
  const two = [1, 2].map((i) => t({ from: '0x' + String(i).repeat(40), to: S, value: '1' }))
  assert.ok(!runRules({ subject: S, chainId: 1, transfers: two, tokenMeta: meta }).find((x) => x.ruleId === 'PG-POISON-003'))
  const three = [1, 2, 3].map((i) => t({ from: '0x' + String(i).repeat(40), to: S, value: '1' }))
  assert.ok(runRules({ subject: S, chainId: 1, transfers: three, tokenMeta: meta }).find((x) => x.ruleId === 'PG-POISON-003'))
})

test('PG-POISON-004 flags counterfeit USDC', () => {
  const fake = '0x' + 'c'.repeat(40)
  const f = runRules({ subject: S, chainId: 1, transfers: [t({ token: fake, from: lookalike, to: S, value: '1000000' })], tokenMeta: { [fake]: { symbol: 'USDC', decimals: 6 } } })
  assert.ok(f.find((x) => x.ruleId === 'PG-POISON-004'))
  assert.ok(!runRules({ subject: S, chainId: 1, transfers: [t({ from: lookalike, to: S, value: '1000000' })], tokenMeta: meta }).find((x) => x.ruleId === 'PG-POISON-004'))
})

test('approval rules: EOA spender critical, unknown unlimited high, known unlimited low', () => {
  const max = (2n ** 256n - 1n).toString()
  const mk = (spender, isC, allowance = max) => ({ token: USDC, spender, allowance, spenderIsContract: isC, lastBlock: 1n })
  const f = runRules({ subject: S, chainId: 1, transfers: [], tokenMeta: meta, approvals: [mk('0x' + '5'.repeat(40), false), mk('0x' + '6'.repeat(40), true), mk('0x000000000022d473030f116ddee9f6b43ac78ba3', true), mk('0x' + '7'.repeat(40), true, '100')] })
  assert.equal(f.find((x) => x.relatedAddress === '0x' + '5'.repeat(40)).severity, 'critical')
  assert.equal(f.find((x) => x.relatedAddress === '0x' + '6'.repeat(40)).severity, 'high')
  assert.equal(f.find((x) => x.relatedAddress === '0x000000000022d473030f116ddee9f6b43ac78ba3').severity, 'low')
  assert.ok(!f.find((x) => x.relatedAddress === '0x' + '7'.repeat(40)), 'finite allowance to a contract is not a finding')
})

test('aggregate never calls an incomplete scan safe', () => {
  assert.equal(aggregate([], [{ source: 'Token transfer history', status: 'unavailable', note: '' }]).riskLabel, 'inconclusive')
  const ok = aggregate([], [{ source: 'Token transfer history', status: 'partial', note: '' }])
  assert.equal(ok.riskLabel, 'low'); assert.match(ok.summary, /does not prove/)
})

test('rules are deterministic', () => {
  const transfers = [t({ from: S, to: LEGIT, value: '5000000000', txFrom: S }), t({ from: lookalike, to: S, value: '0' })]
  assert.deepEqual(runRules({ subject: S, chainId: 1, transfers, tokenMeta: meta }), runRules({ subject: S, chainId: 1, transfers, tokenMeta: meta }))
})
