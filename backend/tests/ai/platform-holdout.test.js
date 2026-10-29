import '../helpers/use-local-embeddings.js'
/**
 * HELD-OUT set: written after tuning finished and never used for tuning.
 * Reported, with a lower bar, to measure how well the assistant generalizes to unseen phrasing.
 */
import { setup, teardown, client } from '../helpers/app.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const HOLDOUT = [
  ['is this thing custodial', ['non-custodial', 'never holds']],
  ['someone on telegram says they are poisonguard support and wants my recovery words', ['impersonating', 'never']],
  ['my scan came back failed, why', ['data provider', 'network']],
  ['what does inconclusive mean', ['not enough data', 'never a clean']],
  ['how does it know an address is a copycat of mine', ['leading', 'trailing']],
  ['got random 0 usdt transfers from strangers', ['zero', 'dust']],
  ['why would a token approval to a normal wallet be bad', ['drainer', 'no contract code']],
  ['the site says verification failed after I revoked', ['not zero', 'new approval']],
  ['how long are share links valid', ['30 days', '90']],
  ['can my teammate who added a vendor address also verify it', ['different member', 'four-eyes']],
  ['who can see the audit log', ['auditor', 'own events']],
  ['can staff at poisonguard approve my payments', ['cannot approve']],
  ['how many approvals does a payment need by default', ['one human approval', 'require']],
  ['my bot keeps getting blocked', ['blocked', 'limit']],
  ['what happens to already sent transactions when I freeze the bot', ['does not cancel']],
  ['where do I see if a payment actually landed on chain', ['confirmed', 'reconcil']],
  ['how do I check a webhook is really from you', ['PoisonGuard-Signature', '5 minutes']],
  ['does upgrading happen immediately after I pay', ['webhook', 'success page']],
  ['how much is the business plan', ['$149', 'business']],
  ['which chains can I revoke on', ['Ethereum', 'Base', 'Arbitrum']],
  ['does it work with cake wallet', ['Cake Wallet', 'not been verified']],
  ['can I upload a pdf to the knowledge base', ['PDF', 'not supported']],
  ['what is SIMULATION_REQUIRED', ['simulator']],
  ['do you sell my data or keep my ip', ['IP', '30 days']],
  ['how accurate is poisonguard', ['evaluation', 'made-up']],
]

let api, modelAvailable = true
before(async () => {
  try { const { createEmbedder } = await import('../../src/adapters/ai/index.js'); await createEmbedder().embed(['probe']) } catch { modelAvailable = false } const { app } = await setup(); api = client(app) })
after(() => teardown())

test('held-out generalization (reported; bar 80%)', async (t) => {
  if (!modelAvailable) return t.skip('pretrained model unavailable (offline): set EMBEDDING_MODEL_PATH or allow Hugging Face download')
  let ok = 0; const misses = []
  for (const [q, facts] of HOLDOUT) {
    const d = (await api.post('/api/v1/assistant/ask', { question: q })).data
    const a = (d.answer || '').toLowerCase()
    const hit = facts.some((f) => a.includes(f.toLowerCase())) // at least one key fact present
    ok += hit
    if (!hit) misses.push(`MISS | ${q} | want one of: ${facts.join(' / ')} | src: ${d.answerSource?.section} | ans: ${(d.answer || '').replace(/\s+/g, ' ').slice(0, 150)}`)
  }
  console.log('HOLDOUT', JSON.stringify({ questions: HOLDOUT.length, answered: ok, accuracy: +(ok / HOLDOUT.length).toFixed(2) }))
  for (const m of misses) console.log(m)
  assert.ok(ok / HOLDOUT.length >= 0.8, `held-out accuracy ${ok}/${HOLDOUT.length}`)
})
