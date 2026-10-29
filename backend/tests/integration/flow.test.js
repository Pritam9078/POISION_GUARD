import { setup, teardown, client, newUser, newWorkspace, addMember, newStaff, waitJobs, Wallet } from '../helpers/app.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ERC20 } from '../../src/adapters/chains/evm.js'

let ctx
const SUBJECT = '0x7a9e4f3b1c2d5e6f8091a2b3c4d5e6f708192a3b'
const LEGIT = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
const LOOK = '0xd8da' + 'e'.repeat(32) + '6045'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const DRAINER = '0x5f2c44a7b01933881cc6ba3ed0b8f2a91e709b1e'
const MAX = 2n ** 256n - 1n

before(async () => {
  ctx = await setup()
  const c = ctx.chain
  c.addToken(USDC, 'USDC', 6)
  c.addTransfer({ token: USDC, from: SUBJECT, to: LEGIT, value: 5_000_000_000n })
  c.addTransfer({ token: USDC, from: LOOK, to: SUBJECT, value: 0n })
  c.addTransfer({ token: USDC, from: SUBJECT, to: LOOK, value: 0n, txFrom: '0x' + '9'.repeat(40) })
  c.setAllowance(USDC, SUBJECT, DRAINER, MAX)
})
after(() => teardown())

async function runScan(api, url, body) {
  const r = await api.post(url, body)
  assert.equal(r.status, 202, JSON.stringify(r.body))
  await waitJobs()
  return r.data.scanId
}

test('public scan: queued → evidence-backed findings, coverage, approvals', async () => {
  const anon = client(ctx.app)
  const id = await runScan(anon, '/api/v1/scans', { network: 'ethereum', input: SUBJECT })
  const s = (await anon.get(`/api/v1/scans/${id}`)).data
  assert.equal(s.status, 'partial') // native history unavailable without indexer → honest partial
  const rules = s.findings.map((f) => f.ruleId).sort()
  assert.deepEqual(rules, ['PG-APPROVAL-002', 'PG-POISON-001', 'PG-POISON-002'])
  const look = s.findings.find((f) => f.ruleId === 'PG-POISON-001')
  assert.equal(look.relatedAddress, LOOK)
  assert.ok(look.evidence.some((e) => e.explorerUrl?.startsWith('https://etherscan.io/tx/')))
  assert.equal(s.findings.find((f) => f.ruleId === 'PG-APPROVAL-002').severity, 'critical')
  assert.ok(s.coverage.find((c) => c.source === 'Native transaction history' && c.status === 'unavailable'))
  assert.equal(s.approvals[0].allowance, 'Unlimited')
  assert.ok(['critical', 'high'].includes(s.riskLabel))
  assert.match(s.disclaimer, /does not prove/)
})

test('invalid input rejected; unconfigured chain fails honestly as inconclusive', async () => {
  const anon = client(ctx.app)
  assert.equal((await anon.post('/api/v1/scans', { network: 'ethereum', input: 'vitalik.eth' })).status, 400)
  const id = await runScan(anon, '/api/v1/scans', { network: 'arbitrum', input: SUBJECT })
  const s = (await anon.get(`/api/v1/scans/${id}`)).data
  assert.equal(s.status, 'failed'); assert.equal(s.riskLabel, 'inconclusive'); assert.equal(s.findings.length, 0)
})

test('transaction scan analyses the spoof victim', async () => {
  const anon = client(ctx.app)
  const h = '0x' + 'f'.repeat(64)
  const attacker = '0x' + '9'.repeat(40)
  ctx.chain.mine({ hash: h, from: attacker, to: USDC, logs: [ctx.chain.erc20TransferLog(USDC, SUBJECT, LOOK, 0)] })
  const id = await runScan(anon, '/api/v1/scans', { chainId: 1, input: h })
  const s = (await anon.get(`/api/v1/scans/${id}`)).data
  assert.equal(s.subjectType, 'transaction')
  assert.ok(s.coverage[0].note.includes(SUBJECT))
  assert.ok(s.findings.some((f) => f.ruleId === 'PG-POISON-001' && f.relatedAddress === LOOK))
})

test('share card is unguessable, read-only and expires', async () => {
  const anon = client(ctx.app)
  const id = await runScan(anon, '/api/v1/scans', { network: 'ethereum', input: SUBJECT })
  const sh = await anon.post(`/api/v1/scans/${id}/share`, { ttlDays: 1 })
  assert.equal(sh.status, 201); assert.ok(sh.data.shareId.length >= 32)
  const card = (await anon.get(`/api/v1/share/${sh.data.shareId}`)).data
  assert.equal(card.findingsCount, 3); assert.match(card.staleness, /snapshot/)
  assert.equal(card.findings[0].evidence, undefined)
  await ctx.db.q(`UPDATE share_links SET expires_at = now() - interval '1 minute' WHERE id = $1`, [sh.data.shareId])
  assert.equal((await anon.get(`/api/v1/share/${sh.data.shareId}`)).status, 404)
})

test('recipient check flags lookalike using sender history', async () => {
  const anon = client(ctx.app)
  const r = await anon.post('/api/v1/recipients/check', { chainId: 1, address: LOOK, senderAddress: SUBJECT, expectedLabel: 'Vitalik' })
  assert.equal(r.status, 200)
  assert.equal(r.data.result, 'suspicious'); assert.equal(r.data.riskLevel, 'CRITICAL')
  const clear = await anon.post('/api/v1/recipients/check', { chainId: 1, address: LEGIT, senderAddress: SUBJECT })
  assert.equal(clear.data.result, 'clear'); assert.match(clear.data.verdict, /not a guarantee/)
  const unknown = await anon.post('/api/v1/recipients/check', { chainId: 1, address: '0x' + '4'.repeat(40) })
  assert.equal(unknown.data.result, 'inconclusive')
})

test('revoke: preview builds approve(spender,0); verified only after allowance re-read is 0', async () => {
  const anon = client(ctx.app)
  const list = await anon.get(`/api/v1/approvals?owner=${SUBJECT}&chainId=1`)
  assert.equal(list.data.items[0].spender, DRAINER)
  const p = await anon.post('/api/v1/approvals/revoke-preview', { chainId: 1, owner: SUBJECT, token: USDC, spender: DRAINER })
  assert.equal(p.data.transaction.to, USDC)
  assert.equal(p.data.transaction.data, ERC20.encodeFunctionData('approve', [DRAINER, 0n]))
  assert.match(p.data.warnings[0], /does not recover/)
  const h = '0x' + '1'.repeat(64)
  // tx mined but allowance not yet changed → verification_failed (no false "revoked")
  ctx.chain.mine({ hash: h, from: SUBJECT, to: USDC, data: p.data.transaction.data })
  let v = await anon.post('/api/v1/approvals/verify', { chainId: 1, owner: SUBJECT, token: USDC, spender: DRAINER, txHash: h })
  assert.equal(v.data.status, 'verification_failed')
  ctx.chain.allowances.set(`${USDC}:${SUBJECT}:${DRAINER}`, 0n)
  v = await anon.post('/api/v1/approvals/verify', { chainId: 1, owner: SUBJECT, token: USDC, spender: DRAINER, txHash: h })
  assert.equal(v.data.status, 'allowance_verified'); assert.equal(v.data.allowanceAfter, '0')
  // a tx with wrong calldata is rejected
  const bad = '0x' + '2'.repeat(64)
  ctx.chain.mine({ hash: bad, from: SUBJECT, to: USDC, data: ERC20.encodeFunctionData('approve', [DRAINER, 5n]) })
  assert.equal((await anon.post('/api/v1/approvals/verify', { chainId: 1, owner: SUBJECT, token: USDC, spender: DRAINER, txHash: bad })).error.code, 'TX_MISMATCH')
  ctx.chain.allowances.set(`${USDC}:${SUBJECT}:${DRAINER}`, MAX)
})

test('false-positive report: reference, dedupe, admin queue, decision (never alters rules)', async () => {
  const anon = client(ctx.app)
  const body = { scanRef: 'scn_x', chainId: 1, subject: LOOK, category: 'False positive', explanation: 'This lookalike is my own vanity address', contact: 'me@example.com', consent: true }
  const r1 = await anon.post('/api/v1/feedback', body)
  assert.equal(r1.status, 201); assert.match(r1.data.reference, /^FP-/)
  const r2 = await anon.post('/api/v1/feedback', body)
  assert.equal(r2.data.duplicate, true); assert.equal(r2.data.reference, r1.data.reference)
  const staff = await newStaff(ctx.app, 'security_reviewer')
  const q = await staff.get('/api/v1/admin/reports')
  const rep = q.data.items.find((x) => x.reference === r1.data.reference)
  assert.ok(rep)
  assert.equal((await staff.post(`/api/v1/admin/reports/${rep.id}/assign`, {})).data.status, 'under_review')
  const d = await staff.post(`/api/v1/admin/reports/${rep.id}/decision`, { decision: 'resolved', notes: 'Confirmed vanity', regressionCandidate: true })
  assert.equal(d.data.status, 'resolved'); assert.match(d.data.note, /never change detection rules/)
  const support = await newStaff(ctx.app, 'billing_ops')
  assert.equal((await support.get('/api/v1/admin/reports')).status, 403)
})

test('wallet sign-in (SIWE): link, sign in, replay rejected, wrong signer rejected', async () => {
  const u = await newUser(ctx.app, 'Wally')
  const w = Wallet.createRandom()
  const ch = await u.post('/api/v1/auth/wallet/challenge', { address: w.address, chainId: 1, purpose: 'link' })
  assert.match(ch.data.message, /does not authorize any transaction/)
  const sig = await w.signMessage(ch.data.message)
  assert.equal((await u.post('/api/v1/auth/wallet/verify', { nonce: ch.data.nonce, signature: sig, walletType: 'cake' })).data.linked, true)
  assert.equal((await u.post('/api/v1/auth/wallet/verify', { nonce: ch.data.nonce, signature: sig })).error.code, 'CHALLENGE_INVALID') // replay
  const anon = client(ctx.app)
  const ch2 = await anon.post('/api/v1/auth/wallet/challenge', { address: w.address, chainId: 1 })
  const imposter = Wallet.createRandom()
  assert.equal((await anon.post('/api/v1/auth/wallet/verify', { nonce: ch2.data.nonce, signature: await imposter.signMessage(ch2.data.message) })).error.code, 'SIGNATURE_INVALID')
  const ch3 = await anon.post('/api/v1/auth/wallet/challenge', { address: w.address, chainId: 1 })
  const ok = await anon.post('/api/v1/auth/wallet/verify', { nonce: ch3.data.nonce, signature: await w.signMessage(ch3.data.message) })
  assert.equal(ok.data.signedIn, true)
  assert.equal((await anon.get('/api/v1/auth/me')).data.user.id, u.user.id)
})

test('Guard: full spend-intent lifecycle with separation of duties and parameter binding', async () => {
  const owner = await newUser(ctx.app, 'Ava')
  const approver = await newUser(ctx.app, 'Priya')
  const approver2 = await newUser(ctx.app, 'Marcus')
  const operator = await newUser(ctx.app, 'Tomas')
  const ws = await newWorkspace(owner, 'Nordguard Labs')
  await ctx.db.q(`UPDATE subscriptions SET plan_key = 'pro' WHERE workspace_id = $1`, [ws]) // free plan = 3 seats; this test needs 4
  await addMember(owner, ws, approver, 'approver'); await addMember(owner, ws, operator, 'operator'); await addMember(owner, ws, approver2, 'admin')
  const W = `/api/v1/workspaces/${ws}`
  const TREASURY = '0x' + 'aa'.repeat(20)
  const wal = await owner.post(`${W}/wallets`, { label: 'Treasury', address: TREASURY, chainId: 1, walletType: 'treasury' })
  assert.equal(wal.status, 201, JSON.stringify(wal.body))

  // trusted recipient: four-eyes verification
  const rc = await operator.post(`${W}/recipients`, { label: 'Cold vault', address: LEGIT, chainId: 'ethereum', allowedUse: 'treasury', verificationMethod: 'independent_confirmation', verificationEvidence: 'Confirmed on video call' })
  assert.equal(rc.data.status, 'pending_verification')
  assert.equal((await operator.post(`${W}/recipients/${rc.data.id}/verify`, { evidence: 'self' })).status, 403)
  assert.equal((await approver.post(`${W}/recipients/${rc.data.id}/verify`, { evidence: 'Checked against signed invoice' })).data.status, 'active')
  const look = await operator.post(`${W}/recipients`, { label: 'Vault 2', address: LOOK, chainId: 1, allowedUse: 'treasury', verificationMethod: 'other', verificationEvidence: 'pasted from history' })
  assert.match(look.data.warnings[0], /resembles existing trusted recipient/)

  // policy: create → activation blocked until simulated → simulate → activate
  const cfg = { recipients: { mode: 'allowlist', untrusted: 'deny' }, limits: [{ asset: USDC, chainId: 1, perTx: '10000000000' }], approvals: { required: 1, thresholds: [{ asset: USDC, chainId: 1, atOrAbove: '9000000000', required: 2 }] } }
  assert.equal((await operator.post(`${W}/policies`, { name: 'x', config: cfg })).status, 403)
  const pol = await owner.post(`${W}/policies`, { name: 'Treasury guardrails', config: cfg })
  assert.equal(pol.status, 201, JSON.stringify(pol.body))
  assert.equal((await owner.post(`${W}/policies/${pol.data.id}/activate`, { version: 1 })).error.code, 'SIMULATION_REQUIRED')
  const sim = await owner.post(`${W}/policies/simulate`, { policyVersionIds: [pol.data.versions[0].id], includeActive: false, input: { chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '8000000000' } })
  assert.equal(sim.data.decision, 'require_approval'); assert.equal(sim.data.requiredApprovals, 1)
  assert.equal((await owner.post(`${W}/policies/${pol.data.id}/activate`, { version: 1, note: 'after sim' })).data.status, 'active')

  // intent to the LOOKALIKE is denied despite matching the allowlist pattern visually
  const bad = await operator.post(`${W}/spend-intents`, { walletId: wal.data.id, chainId: 1, toAddress: LOOK, assetType: 'erc20', tokenAddress: USDC, amount: '1000000', purpose: 'test', evaluate: true })
  assert.equal(bad.data.status, 'denied')
  assert.ok(bad.data.policyResult.reasonCodes.includes('RECIPIENT_LOOKALIKE_OF_TRUSTED'))

  // happy path
  const i = await operator.post(`${W}/spend-intents`, { walletId: wal.data.id, chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '8000000000', purpose: 'Weekly sweep' })
  assert.equal(i.data.status, 'draft'); assert.equal(i.data.amount, '8,000')
  const replay = await operator.post(`${W}/spend-intents`, { walletId: wal.data.id, chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '8000000000', purpose: 'Weekly sweep' })
  assert.equal(replay.data.replayed, true); assert.equal(replay.data.id, i.data.id)
  const I = `${W}/spend-intents/${i.data.id}`
  assert.equal((await operator.post(`${I}/evaluate`)).data.status, 'pending_approval')
  assert.equal((await operator.post(`${I}/approve`, {})).status, 403) // operator lacks capability
  const mine = await approver.get(`${W}/approvals?tab=pending_mine`)
  assert.ok(mine.data.items.some((x) => x.id === i.data.id))
  assert.equal((await approver.post(`${I}/reject`, { reason: '' })).status, 400) // reason mandatory
  assert.equal((await approver.post(`${I}/approve`, { reason: 'matches schedule' })).data.status, 'approved')

  // editing after approval voids the approval and returns to draft
  const ed = await operator.patch(I, { amount: '9500000000' })
  assert.equal(ed.data.status, 'draft'); assert.equal(ed.data.approvalsInvalidated, true)
  assert.equal(ed.data.approvals[0].boundToCurrentParams, false)
  assert.equal((await operator.post(`${I}/prepare`)).error.code, 'INVALID_STATE_TRANSITION')
  const re = await operator.post(`${I}/evaluate`)
  assert.equal(re.data.requiredApprovals, 2) // threshold crossed
  await approver.post(`${I}/approve`, { reason: 'ok' })
  assert.equal((await approver.post(`${I}/approve`, { reason: 'again' })).error.code, 'DUPLICATE_APPROVAL')
  assert.equal((await approver2.post(`${I}/approve`, { reason: 'second' })).data.status, 'approved')

  // prepare → unsigned tx; submit hash → reconcile against chain
  const prep = await operator.post(`${I}/prepare`)
  assert.equal(prep.data.status, 'ready_to_sign')
  assert.equal(prep.data.unsignedTransaction.to, USDC)
  assert.equal(prep.data.unsignedTransaction.data, ERC20.encodeFunctionData('transfer', [LEGIT, 9500000000n]))
  const h = '0x' + '3'.repeat(64)
  assert.equal((await operator.post(`${I}/submit`, { txHash: h })).data.status, 'submitted')
  ctx.chain.mine({ hash: h, from: TREASURY, to: USDC, data: prep.data.unsignedTransaction.data, logs: [{ ...ctx.chain.erc20TransferLog(USDC, TREASURY, LEGIT, 9500000000n), address: USDC }] })
  const rec = await operator.post(`${I}/reconcile`)
  assert.equal(rec.data.status, 'confirmed', JSON.stringify(rec.data.reconcile))
  assert.match(rec.data.execution.reconciliation, /match the approved parameters/)

  // overview keeps authorized / submitted / confirmed separate
  const ov = (await owner.get(`${W}/overview`)).data
  assert.equal(ov.intents.confirmedOnChain, 1); assert.equal(ov.intents.denied, 1)

  // reconciliation mismatch (fee-on-transfer) opens a spend incident
  const j = await operator.post(`${W}/spend-intents`, { walletId: wal.data.id, chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '1000000', purpose: 'Small', evaluate: true })
  const J2 = `${W}/spend-intents/${j.data.id}`
  await approver.post(`${J2}/approve`, { reason: 'ok' })
  const p2 = await operator.post(`${J2}/prepare`)
  const h2 = '0x' + '4'.repeat(64)
  await operator.post(`${J2}/submit`, { txHash: h2 })
  ctx.chain.mine({ hash: h2, from: TREASURY, to: USDC, data: p2.data.unsignedTransaction.data, logs: [{ ...ctx.chain.erc20TransferLog(USDC, TREASURY, LEGIT, 999000n), address: USDC }] })
  assert.equal((await operator.post(`${J2}/reconcile`)).data.status, 'reconciliation_mismatch')
  const ev = (await owner.get(`${W}/security-events`)).data.items
  assert.ok(ev.some((e) => e.category === 'reconciliation_mismatch'))

  // audit chain covers it all and verifies
  const v = await owner.post(`${W}/audit/verify`, {})
  assert.equal(v.data.verified, true); assert.ok(v.data.eventsChecked > 15); assert.match(v.data.statement, /not an on-chain anchor/)
  assert.equal((await operator.post(`${W}/audit/verify`, {})).status, 403)
  const own = await operator.get(`${W}/audit`)
  assert.ok(own.data.items.every((e) => e.actorId === operator.user.id))
})

test('agents: credentials once, proposals only, limits & tool allowlist enforced, freeze', async () => {
  const owner = await newUser(ctx.app, 'Owner')
  const ws = await newWorkspace(owner, 'Agents WS')
  await ctx.db.q(`UPDATE subscriptions SET plan_key = 'pro' WHERE workspace_id = $1`, [ws])
  const W = `/api/v1/workspaces/${ws}`
  const wal = await owner.post(`${W}/wallets`, { label: 'Ops', address: '0x' + 'bb'.repeat(20), chainId: 1, walletType: 'agent_controlled' })
  const reg = await owner.post(`${W}/agents`, { name: 'treasury-rebalancer', description: 'Rebalances idle USDC', allowedChains: [1], controlledWalletIds: [wal.data.id], tools: ['propose_transfer'], perTxLimits: [{ asset: USDC, chainId: 1, amount: '10000000000' }], expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString() })
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); assert.equal(reg.data.status, 'pending')
  const A = `${W}/agents/${reg.data.id}`
  assert.equal((await owner.post(`${A}/credentials`, {})).error.code, 'AGENT_NOT_ACTIVE')
  await owner.post(`${A}/activate`)
  const cred = await owner.post(`${A}/credentials`, { label: 'Primary' })
  assert.ok(cred.data.secret.startsWith('pgk_live_'))
  assert.ok(!JSON.stringify((await owner.get(`${A}/credentials`)).body).includes(cred.data.secret)) // never returned again
  const bot = client(ctx.app)
  const H = { authorization: `Bearer ${cred.data.secret}` }
  const over = await bot.post('/api/v1/agent/v1/spend-intents', { walletId: wal.data.id, chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '15000000000', purpose: 'too much' }, H)
  assert.equal(over.data.status, 'denied'); assert.ok(over.data.reasonCodes.includes('AGENT_PER_TX_LIMIT'))
  const okp = await bot.post('/api/v1/agent/v1/spend-intents', { walletId: wal.data.id, chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '1000000', purpose: 'fine' }, H)
  assert.equal(okp.data.status, 'pending_approval') // no policy → one human approval
  assert.equal((await bot.post('/api/v1/agent/v1/check-recipient', { chainId: 1, address: LEGIT }, H)).error.code, 'TOOL_NOT_PERMITTED')
  // agent owner cannot approve their own agent's spend
  assert.equal((await owner.post(`${W}/spend-intents/${okp.data.id}/approve`, {})).status, 403)
  const fr = await owner.post(`${A}/freeze`, { reason: 'Suspicious behaviour' })
  assert.equal(fr.data.status, 'frozen'); assert.ok(fr.data.cancelledPendingIntents.includes(okp.data.id))
  assert.equal((await bot.post('/api/v1/agent/v1/spend-intents', { walletId: wal.data.id, chainId: 1, toAddress: LEGIT, assetType: 'erc20', tokenAddress: USDC, amount: '1', purpose: 'x' }, H)).error.code, 'AGENT_NOT_ACTIVE')
  const blocked = (await owner.get(`${A}/blocked-requests`)).data.items
  assert.ok(blocked.some((b) => b.tool === 'check_recipient'))
})

test('Dodo webhooks: signature required, idempotent, out-of-order safe, entitlements updated', async () => {
  const { createHmac } = await import('node:crypto')
  const owner = await newUser(ctx.app, 'Biller')
  const ws = await newWorkspace(owner, 'Billing WS')
  const key = Buffer.from(process.env.DODO_WEBHOOK_SECRET.slice(6), 'base64')
  const send = async (id, event, sigOverride) => {
    const body = JSON.stringify(event), ts = String(Math.floor(Date.now() / 1000))
    const sig = sigOverride ?? 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
    return ctx.app.inject({ method: 'POST', url: '/api/v1/webhooks/dodo', payload: body, headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': sig } })
  }
  const active = { business_id: 'b', type: 'subscription.active', timestamp: new Date().toISOString(), data: { payload_type: 'Subscription', subscription_id: 'sub_1', metadata: { workspace_id: ws, plan_key: 'pro' }, customer: { customer_id: 'cus_1' }, next_billing_date: new Date(Date.now() + 30 * 86400_000).toISOString() } }
  assert.equal((await send('msg_bad', active, 'v1,AAAA')).statusCode, 401)
  assert.equal((await send('msg_1', active)).statusCode, 200)
  assert.equal((await send('msg_1', active)).json().data.duplicate, true)
  let b = (await owner.get(`/api/v1/workspaces/${ws}/billing`)).data
  assert.equal(b.planKey, 'pro'); assert.equal(b.status, 'active'); assert.equal(b.entitlements.watchedWallets, 10)
  const stale = { ...active, type: 'subscription.on_hold', timestamp: new Date(Date.now() - 3600_000).toISOString() }
  assert.equal((await send('msg_2', stale)).json().data.outOfOrder, true)
  await send('msg_3', { ...active, type: 'subscription.cancelled', timestamp: new Date(Date.now() + 1000).toISOString() })
  b = (await owner.get(`/api/v1/workspaces/${ws}/billing`)).data
  assert.equal(b.planKey, 'free')
})

test('knowledge + assistant: access-scoped hybrid retrieval, citations, refuses actions', async () => {
  const owner = await newUser(ctx.app, 'Kb')
  const auditor = await newUser(ctx.app, 'Aud')
  const ws = await newWorkspace(owner, 'KB WS')
  await addMember(owner, ws, auditor, 'auditor')
  await ctx.db.q(`UPDATE subscriptions SET plan_key = 'pro' WHERE workspace_id = $1`, [ws])
  await ctx.db.q(`UPDATE feature_flags SET enabled = true, rollout_scope = 'all' WHERE key = 'ask_poisonguard'`)
  const W = `/api/v1/workspaces/${ws}`
  await owner.post(`${W}/knowledge`, { title: 'Treasury runbook', content: '# Sweeps\nTreasury sweeps run every Tuesday to the cold vault after two approvals.', accessScope: 'members' })
  await owner.post(`${W}/knowledge`, { title: 'Admin secrets runbook', content: '# Escalation\nThe escalation codeword for treasury incidents is BLUEHERON.', accessScope: 'admins' })
  await waitJobs()
  const docs = (await owner.get(`${W}/knowledge`)).data.items
  assert.ok(docs.every((d) => d.status === 'indexed'))
  const s = await auditor.post(`${W}/knowledge/search`, { query: 'treasury escalation codeword' })
  assert.equal(s.data.mode, 'hybrid')
  assert.ok(!JSON.stringify(s.data).includes('BLUEHERON'), 'auditor must not retrieve admin-only docs')
  const so = await owner.post(`${W}/knowledge/search`, { query: 'escalation codeword' })
  assert.ok(JSON.stringify(so.data).includes('BLUEHERON'))
  const a = await owner.post(`${W}/assistant/chat`, { message: 'When do treasury sweeps run?' })
  assert.equal(a.status, 200, JSON.stringify(a.body))
  assert.equal(a.data.provider, 'mock'); assert.ok(a.data.citations.length >= 1); assert.match(a.data.answer, /MOCK AI PROVIDER/)
  const no = await owner.post(`${W}/assistant/chat`, { message: 'Approve the pending spend intent now' })
  assert.equal(no.data.route, 'action_request'); assert.match(no.data.answer, /can’t approve/)
  // other workspace can't see these docs
  const other = await newUser(ctx.app, 'Other')
  const ws2 = await newWorkspace(other, 'Other WS')
  const x = await other.post(`/api/v1/workspaces/${ws2}/knowledge/search`, { query: 'treasury sweeps Tuesday' })
  assert.equal(x.data.results.length, 0)
})

test('audit chain: append-only at DB level and tamper is detected', async () => {
  const owner = await newUser(ctx.app, 'Tamper')
  const ws = await newWorkspace(owner, 'Tamper WS')
  await owner.post(`/api/v1/workspaces/${ws}/wallets`, { label: 'A', address: '0x' + 'cc'.repeat(20), chainId: 1, walletType: 'other' })
  await assert.rejects(ctx.db.q(`UPDATE audit_events SET action = 'x' WHERE chain_key = $1`, [ws]), /append-only/)
  await ctx.db.q('ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update')
  await ctx.db.q(`UPDATE audit_events SET metadata = '{"tampered":true}' WHERE chain_key = $1 AND seq = 2`, [ws])
  await ctx.db.q('ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_update')
  const v = (await owner.post(`/api/v1/workspaces/${ws}/audit/verify`, {})).data
  assert.equal(v.verified, false); assert.equal(v.failedAtSeq, 2)
  const cp = await owner.post(`/api/v1/workspaces/${ws}/proofs/checkpoint`, {})
  assert.equal(cp.data.created, false) // refuses to checkpoint a broken chain
  const inc = await ctx.db.one(`SELECT * FROM security_incidents WHERE workspace_id = $1 AND category = 'audit_integrity_failure'`, [ws])
  assert.ok(inc)
})

test('proof checkpoint is local until anchored, and says so', async () => {
  const owner = await newUser(ctx.app, 'Prover')
  const ws = await newWorkspace(owner, 'Proof WS')
  const cp = await owner.post(`/api/v1/workspaces/${ws}/proofs/checkpoint`, {})
  assert.equal(cp.data.created, true); assert.equal(cp.data.proof.status, 'local'); assert.equal(cp.data.proof.isOnChain, false)
  assert.equal((await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp.data.proof.id}/anchor`)).error.code, 'ANCHOR_NOT_CONFIGURED')
  const v = await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp.data.proof.id}/verify`)
  assert.match(v.data.verification, /Not anchored on-chain/)
})
