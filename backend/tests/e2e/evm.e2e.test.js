/**
 * End-to-end against a REAL EVM JSON-RPC node (Hardhat/Anvil) using the production EvmChainAdapter.
 * Skipped unless E2E_RPC_URL is set. Start a node with: (cd contracts && npx hardhat node)
 */
import '../helpers/env.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JsonRpcProvider, Wallet, ContractFactory, Contract, MaxUint256, NonceManager } from 'ethers'

const RPC = process.env.E2E_RPC_URL
const skip = !RPC && 'E2E_RPC_URL not set'
const KEYS = ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a']
const LEGIT = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
const LOOK = '0xd8da' + 'e'.repeat(32) + '6045'
const DRAINER = '0x' + '5f'.repeat(20)
const art = (p) => JSON.parse(readFileSync(new URL(`../../contracts/artifacts/src/${p}`, import.meta.url)))
let h, ctx, provider, attacker, victim, staffKey, token, registry
const mine = (n = 3) => provider.send('hardhat_mine', ['0x' + n.toString(16)])

before(async () => {
  if (skip) return
  provider = new JsonRpcProvider(RPC, undefined, { staticNetwork: true })
  ;[attacker, victim, staffKey] = KEYS.map((k) => new NonceManager(new Wallet(k, provider)))
  const T = art('test-fixtures/TestToken.sol/TestToken.json'), R = art('ProofRegistry.sol/ProofRegistry.json')
  token = await (await new ContractFactory(T.abi, T.bytecode, attacker).deploy('Test USD', 'TUSD', 6)).waitForDeployment()
  const sk = await staffKey.getAddress()
  registry = await (await new ContractFactory(R.abi, R.bytecode, staffKey).deploy(0, sk, sk, sk, sk)).waitForDeployment()
  // ── stage a real poisoning scenario on chain ──
  await (await token.mint(await victim.getAddress(), 10_000_000_000n)).wait()
  await (await token.connect(victim).transfer(LEGIT, 2_500_000_000n)).wait()            // genuine payment
  await (await token.connect(attacker).transferFrom(await victim.getAddress(), LOOK, 0n)).wait() // zero-value spoof in victim's name
  await (await token.connect(victim).approve(DRAINER, MaxUint256)).wait()               // unlimited approval to an EOA
  await mine(3)
  process.env.SEPOLIA_RPC_URL = RPC
  process.env.PROOF_REGISTRY_CHAIN_ID = '11155111'
  process.env.PROOF_REGISTRY_ADDRESS = await registry.getAddress()
  process.env.PROOF_ANCHOR_PRIVATE_KEY = KEYS[2]
  h = await import('../helpers/app.js')
  ctx = await h.setup({ realChains: true })
})
after(async () => { if (!skip) await h.teardown() })

test('real chain: scan detects lookalike, spoofed zero-value transfer and EOA approval', { skip }, async () => {
  const anon = h.client(ctx.app)
  const v = (await victim.getAddress()).toLowerCase()
  const r = await anon.post('/api/v1/scans', { chainId: 11155111, input: v })
  assert.equal(r.status, 202)
  await h.waitJobs()
  const s = (await anon.get(`/api/v1/scans/${r.data.scanId}`)).data
  const rules = s.findings.map((f) => f.ruleId).sort()
  assert.deepEqual(rules, ['PG-APPROVAL-002', 'PG-POISON-001', 'PG-POISON-002'], JSON.stringify(s.coverage))
  const spoof = s.findings.find((f) => f.ruleId === 'PG-POISON-002')
  assert.equal(spoof.confidence, 85) // tx sender resolved via eth_getTransactionByHash → confirmed third party
  assert.equal(s.coverage.find((c) => c.source === 'Token transfer history').status, 'covered')
  assert.equal(s.approvals[0].spender, DRAINER); assert.equal(s.approvals[0].allowance, 'Unlimited')
})

test('real chain: revoke preview → user signs → verified by allowance re-read', { skip }, async () => {
  const anon = h.client(ctx.app)
  const owner = (await victim.getAddress()).toLowerCase(), tok = (await token.getAddress()).toLowerCase()
  const p = (await anon.post('/api/v1/approvals/revoke-preview', { chainId: 11155111, owner, token: tok, spender: DRAINER })).data
  assert.ok(p.estimatedGas)
  const sent = await victim.sendTransaction({ to: p.transaction.to, data: p.transaction.data, value: 0 })
  const v0 = (await anon.post('/api/v1/approvals/verify', { chainId: 11155111, owner, token: tok, spender: DRAINER, txHash: sent.hash })).data
  assert.ok(['confirmed_pending_finality', 'allowance_verified'].includes(v0.status))
  await mine(3)
  const v = (await anon.post('/api/v1/approvals/verify', { chainId: 11155111, owner, token: tok, spender: DRAINER, txHash: sent.hash })).data
  assert.equal(v.status, 'allowance_verified'); assert.equal(v.allowanceAfter, '0')
})

test('real chain: approved native intent signed externally reconciles as confirmed; wrong value is a mismatch', { skip }, async () => {
  const owner = await h.newUser(ctx.app, 'E2E Owner'), appr = await h.newUser(ctx.app, 'E2E Approver')
  const ws = await h.newWorkspace(owner, 'E2E WS'); await h.addMember(owner, ws, appr, 'approver')
  const W = `/api/v1/workspaces/${ws}`
  const from = (await victim.getAddress()).toLowerCase()
  const wal = await owner.post(`${W}/wallets`, { label: 'Treasury', address: from, chainId: 11155111, walletType: 'treasury' })
  const run = async (amount, sendValue) => {
    const i = await owner.post(`${W}/spend-intents`, { walletId: wal.data.id, chainId: 11155111, toAddress: LEGIT, assetType: 'native', amount, purpose: 'e2e ' + amount, evaluate: true })
    await appr.post(`${W}/spend-intents/${i.data.id}/approve`, { reason: 'e2e' })
    const prep = (await owner.post(`${W}/spend-intents/${i.data.id}/prepare`)).data.unsignedTransaction
    const tx = await victim.sendTransaction({ to: prep.to, value: sendValue ?? BigInt(prep.value), data: prep.data })
    await owner.post(`${W}/spend-intents/${i.data.id}/submit`, { txHash: tx.hash })
    await mine(3)
    return (await owner.post(`${W}/spend-intents/${i.data.id}/reconcile`)).data
  }
  assert.equal((await run('1000000000000000')).status, 'confirmed')
  assert.equal((await run('2000000000000000', 1999999999999999n)).status, 'reconciliation_mismatch')
})

test('real chain: audit checkpoint anchored on ProofRegistry and verified from receipt + event', { skip }, async () => {
  const owner = await h.newUser(ctx.app, 'Anchor')
  const ws = await h.newWorkspace(owner, 'Anchor WS')
  const cp = (await owner.post(`/api/v1/workspaces/${ws}/proofs/checkpoint`, {})).data
  const a = await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp.proof.id}/anchor`)
  assert.equal(a.data.status, 'submitted', JSON.stringify(a.body))
  await mine(2)
  const v = (await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp.proof.id}/verify`)).data
  assert.equal(v.status, 'anchored'); assert.equal(v.isOnChain, true)
  const onchain = await new Contract(await registry.getAddress(), ['function verify(bytes32,bytes32) view returns (bool,bool,bool,uint64)', 'function revoke(bytes32,bytes32)'], staffKey)
  const [exists, matches, revoked] = await onchain.verify(cp.proof.batchId, cp.proof.commitment)
  assert.deepEqual([exists, matches, revoked], [true, true, false])
  // a second checkpoint chains onto the first (scope ordering)
  await owner.post(`/api/v1/workspaces/${ws}/wallets`, { label: 'x', address: '0x' + 'de'.repeat(20), chainId: 1, walletType: 'other' })
  const cp2 = (await owner.post(`/api/v1/workspaces/${ws}/proofs/checkpoint`, {})).data
  assert.equal((await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp2.proof.id}/anchor`)).data.status, 'submitted')
  await mine(2)
  assert.equal((await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp2.proof.id}/verify`)).data.status, 'anchored')
  // revocation on-chain is detected by the backend
  staffKey.reset() // backend used the same key; resync the test's nonce cache
  await (await onchain.revoke(cp.proof.batchId, '0x' + '11'.repeat(32))).wait(); await mine(1)
  const rv = (await owner.post(`/api/v1/workspaces/${ws}/proofs/${cp.proof.id}/verify`)).data
  assert.equal(rv.status, 'failed'); assert.match(rv.verification, /REVOKED/)
})
