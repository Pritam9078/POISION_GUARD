import '../helpers/use-local-embeddings.js'
/**
 * Does the assistant actually know the platform end to end?
 * 50 realistic user questions → expected source section + facts the answer must contain.
 * Runs in EXTRACTIVE mode (no generative model), i.e. the out-of-the-box behaviour.
 * Scores: retrieval@1, retrieval@3, answer-fact accuracy. Thresholds are asserted; misses are printed.
 */
import { setup, teardown, client } from '../helpers/app.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const CASES = [
  // overview
  ['what is poisonguard', 'What is PoisonGuard?', ['non-custodial']],
  ['does poisonguard hold my private keys', 'What is PoisonGuard?', ['never holds']],
  ['will you ever ask for my seed phrase', 'seed phrase', ['Never']],
  ['is a scan with no findings safe', 'guarantee that an address is safe', ['does not prove']],
  ['what is the difference between the public site and guard', 'parts of the platform', ['Guard']],
  // scanner
  ['how do I scan an address', 'How do I scan a wallet', ['Scan']],
  ['can I scan an ENS name like vitalik.eth', 'How do I scan a wallet', ['ENS']],
  ['what does partial status mean on my scan', 'scan statuses', ['partial means']],
  ['what is the risk score', 'risk labels and risk score', ['not a calibrated']],
  ['what does data coverage show', 'data coverage', ['covered, partial or unavailable']],
  ['what does on-chain fact mean in the evidence', 'fact, a measurement and an interpretation', ['On-chain fact']],
  ['how do I share a scan result', 'share or export a scan', ['unguessable']],
  ['can I scan a transaction hash', 'scan a transaction hash', ['receipt']],
  // rules
  ['what is address poisoning', 'What is address poisoning?', ['looks like']],
  ['how are lookalike addresses detected', 'lookalike addresses', ['4 leading and 4 trailing']],
  ['what is a zero value transfer spoof', 'zero-value transfer spoof', ['transferFrom']],
  ['what is a dust attack', 'dust burst', ['three or more']],
  ['what is a fake usdc token', 'counterfeit token', ['non-canonical']],
  ['why is an unlimited approval risky', 'approval risky', ['unlimited']],
  ['which methodology version is used', 'methodology version', ['1.0']],
  // recipient / revoke / report
  ['how do I check a recipient address before sending', 'check a recipient', ['clear, suspicious or inconclusive']],
  ['how do I revoke an approval', 'revoke token approvals', ['approve(spender, 0)']],
  ['does revoking get my stolen tokens back', 'revoke token approvals', ['does not recover']],
  ['how do I report a false positive', 'incorrect finding', ['FP-']],
  ['i sent money to a poisoned address what now', 'already sent funds', ['cannot be reversed']],
  ['how do I report a phishing clone of poisonguard', 'fake PoisonGuard site', ['anti-phishing']],
  // guard basics
  ['how do I create a workspace', 'Guard account and workspace', ['owner']],
  ['how do I sign in with metamask', 'sign in with my wallet', ['Sign-In with Ethereum']],
  ['my account got locked', 'account is locked', ['15 minutes']],
  ['how long is an invitation valid', 'invitations work', ['default 7']],
  // roles
  ['what roles are there', 'What roles are there', ['Owner, Admin, Approver, Operator and Auditor']],
  ['can I approve my own spend request', 'approve my own spend request', ['No']],
  ['what can an auditor do', 'Auditor role', ['audit']],
  ['can the last owner be removed', 'last owner', ['cannot be removed']],
  // wallets & recipients
  ['how do I add a watched wallet', 'add a watched wallet', ['monitoring']],
  ['how are trusted recipients verified', 'trusted recipients and how are they verified', ['different member']],
  ['does a trusted recipient bypass policy limits', 'bypass policy', ['No']],
  // intents & approvals
  ['what is a spend intent', 'What is a spend intent?', ['proposal']],
  ['what happens if I edit an intent after approval', 'change an intent after it was approved', ['invalidates']],
  ['how do I execute an approved payment', 'execute an approved intent', ['Prepare']],
  ['what does reconciliation mismatch mean', ['execute an approved intent', 'stages of a spend intent'], ['reconciliation mismatch']],
  // policies
  ['how do I activate a policy', 'create and activate a policy', ['simulator']],
  ['why are limits not in dollars', 'base units and not dollars', ['price oracle']],
  ['what happens if no policy applies', 'policy decisions made', ['one human approval']],
  // agents
  ['how do I register an ai agent', 'register an AI agent', ['pending']],
  ['what happens when I freeze an agent', 'freeze an agent', ['does not cancel']],
  ['can an agent approve its own transfers', ['agent API', 'approve my own spend request'], ['never approve']],
  // audit / billing / misc
  ['how do I verify the audit log', 'verify the audit log', ['not an on-chain anchor']],
  ['how do webhook signatures work', 'webhooks work', ['PoisonGuard-Signature']],
  ['what does PLAN_LIMIT mean', 'error messages mean', ['upgrade']],
]

let app, api, modelAvailable = true
before(async () => {
  try { const { createEmbedder } = await import('../../src/adapters/ai/index.js'); await createEmbedder().embed(['probe']) } catch { modelAvailable = false } ({ app } = await setup()); api = client(app) })
after(() => teardown())

test('platform knowledge: retrieval and answer accuracy (extractive mode)', async (t) => {
  if (!modelAvailable) return t.skip('pretrained model unavailable (offline): set EMBEDDING_MODEL_PATH or allow Hugging Face download')
  let r1 = 0, r3 = 0, facts = 0
  const misses = []
  for (const [q, sectionWant, mustHave] of CASES) {
    const wants = [].concat(sectionWant), section = wants[0]
    const res = await api.post('/api/v1/assistant/ask', { question: q })
    assert.equal(res.status, 200, `${q}: ${JSON.stringify(res.body)}`)
    const d = res.data
    const secs = d.citations.map((c) => c.section)
    // @1 = the section the answer was actually quoted from (what the user reads)
    const hit1 = wants.some((w) => (d.answerSource?.section || secs[0] || '').toLowerCase().includes(w.toLowerCase()))
    const hit3 = hit1 || secs.slice(0, 3).some((s) => wants.some((w) => s.toLowerCase().includes(w.toLowerCase())))
    const ans = (d.answer || '').toLowerCase()
    const okFacts = mustHave.every((f) => ans.includes(f.toLowerCase()))
    r1 += hit1; r3 += hit3; facts += okFacts
    if (!hit3 || !okFacts) misses.push({ q, want: section, got: secs.slice(0, 3), missingFacts: mustHave.filter((f) => !ans.includes(f.toLowerCase())), answer: d.answer?.slice(0, 160) })
  }
  const n = CASES.length
  const report = { questions: n, retrievalAt1: +(r1 / n).toFixed(2), retrievalAt3: +(r3 / n).toFixed(2), answerFactAccuracy: +(facts / n).toFixed(2) }
  console.log('PLATFORM KNOWLEDGE EVAL', JSON.stringify(report))
  if (misses.length) for (const m of misses) console.log(`MISS | ${m.q} | want: ${m.want} | got: ${m.got.join(' || ')} | missing: ${m.missingFacts.join(',')} | ans: ${(m.answer || '').replace(/\s+/g, ' ').slice(0, 140)}`)
  assert.ok(report.retrievalAt3 >= 0.95, `retrieval@3 ${report.retrievalAt3}`)
  assert.ok(report.answerFactAccuracy >= 0.9, `answer accuracy ${report.answerFactAccuracy}`)
})

test('platform knowledge: refuses actions and redirects live questions on the public endpoint too', async () => {
  for (const q of ['approve SI-501', 'send 1 ETH to my friend', 'mark 0xabc as safe']) assert.equal((await api.post('/api/v1/assistant/ask', { question: q })).data.route, 'action_request')
  assert.equal((await api.post('/api/v1/assistant/ask', { question: 'what is my current USDC allowance' })).data.route, 'live_blockchain')
})

test('platform knowledge: public help never sees workspace documents', async () => {
  const { newUser, newWorkspace } = await import('../helpers/app.js')
  const o = await newUser(app, 'KbPriv'); const ws = await newWorkspace(o, 'KB Private WS')
  await o.post(`/api/v1/workspaces/${ws}/knowledge`, { title: 'Secret runbook', content: '# Secret\nThe vault override phrase is MARMALADE-SUNRISE and must stay internal.', accessScope: 'members' })
  const r = await api.post('/api/v1/assistant/ask', { question: 'what is the vault override phrase' })
  assert.ok(!JSON.stringify(r.data).includes('MARMALADE'))
})

test('platform knowledge: role-aware answers inside Guard come from the capability matrix', async () => {
  const { newUser, newWorkspace, addMember } = await import('../helpers/app.js')
  const o = await newUser(app, 'RoleO'); const op = await newUser(app, 'RoleOp'); const ws = await newWorkspace(o, 'Role WS')
  const { db } = await import('../../src/db/index.js')
  await db.q(`UPDATE subscriptions SET plan_key = 'business' WHERE workspace_id = $1`, [ws])
  await addMember(o, ws, op, 'operator')
  const r = (await op.post(`/api/v1/workspaces/${ws}/assistant/chat`, { message: 'what can I do in this workspace?' })).data
  assert.match(r.answer, /Your role in "Role WS" is operator/)
  assert.ok(r.answer.includes('create and edit spend intents')); assert.ok(!r.answer.includes('approve or reject spend intents;'))
  assert.equal(r.mode, 'extractive') // flag off → no generative model, still useful
})

test('platform knowledge: corpus is versioned and re-ingestion is idempotent', async () => {
  const { ingestPlatformKnowledge } = await import('../../src/modules/knowledge/platform-corpus.js')
  const r = await ingestPlatformKnowledge()
  assert.equal(r.created + r.updated, 0); assert.ok(r.unchanged >= 15)
})
