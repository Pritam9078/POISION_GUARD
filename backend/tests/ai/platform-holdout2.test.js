import '../helpers/use-local-embeddings.js'
/**
 * SECOND held-out set — written BEFORE the fixes that followed held-out set 1, and not used for tuning.
 * This is the number to quote for generalization.
 */
import { setup, teardown, client } from '../helpers/app.js'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const SET = [
  ['do I need an account to scan a wallet', ['no account']],
  ['can you guys see my private key', ['never']],
  ['is my wallet hacked if I see a lookalike address', ['does not prove', 'never proves', 'similarity alone']],
  ['what if two addresses only share the first few letters', ['4 leading', 'weak']],
  ['someone sent me fake usdt', ['non-canonical', 'counterfeit']],
  ['how do i stop a dapp from spending my tokens', ['approve(spender, 0)', 'revoke']],
  ['what is approve 0', ['approve(spender, 0)']],
  ['my coworker wants to approve their own transfer is that allowed', ['cannot approve', 'separation of duties']],
  ['how do I give someone read only access', ['auditor', 'read-only']],
  ['how do i change the amount on a request that was already approved', ['invalidates', 'draft']],
  ['can a policy block payments on weekends', ['time window']],
  ['what is the policy simulator for', ['nothing is created', 'simulat']],
  ['how do I rotate an api key for my agent', ['rotate']],
  ['what if my agent key leaks', ['revoke', 'rotate', 'freeze']],
  ['how do i prove our audit log was not tampered with', ['verify', 'hash']],
  ['what is anchoring', ['anchored', 'ProofRegistry']],
  ['how much does pro cost', ['$49']],
  ['how many people can I invite on the free plan', ['3']],
  ['does it support polygon', ['Polygon']],
  ['what does RECIPIENT_LOOKALIKE_OF_TRUSTED mean', ['lookalike', 'denied']],
]

let api, modelAvailable = true
before(async () => {
  try { const { createEmbedder } = await import('../../src/adapters/ai/index.js'); await createEmbedder().embed(['probe']) } catch { modelAvailable = false } const { app } = await setup(); api = client(app) })
after(() => teardown())

test('held-out set 2 (reported; bar 80%)', async (t) => {
  if (!modelAvailable) return t.skip('pretrained model unavailable (offline): set EMBEDDING_MODEL_PATH or allow Hugging Face download')
  let ok = 0; const misses = []
  for (const [q, facts] of SET) {
    const d = (await api.post('/api/v1/assistant/ask', { question: q })).data
    const a = (d.answer || '').toLowerCase()
    const hit = facts.some((f) => a.includes(f.toLowerCase()))
    ok += hit
    if (!hit) misses.push(`MISS | ${q} | want one of: ${facts.join(' / ')} | src: ${d.answerSource?.section} | ans: ${(d.answer || '').replace(/\s+/g, ' ').slice(0, 150)}`)
  }
  console.log('HOLDOUT2', JSON.stringify({ questions: SET.length, answered: ok, accuracy: +(ok / SET.length).toFixed(2) }))
  for (const m of misses) console.log(m)
  assert.ok(ok / SET.length >= 0.8, `held-out-2 accuracy ${ok}/${SET.length}`)
})
