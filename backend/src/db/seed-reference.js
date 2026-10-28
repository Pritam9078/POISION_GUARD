import { db } from './index.js'
import { CHAINS, CANONICAL_TOKENS } from '../shared/chains.js'
import { STAFF_ROLES } from '../shared/permissions.js'
import { RULES, METHODOLOGY_VERSION } from '../modules/scanner/rules.js'
import { newId } from '../shared/ids.js'
import { PLANS } from '../shared/plans.js'

/** Idempotent reference data (no demo/customer data). Runs on every boot. */
export async function seedReference() {
  for (const c of CHAINS) {
    await db.q(`INSERT INTO chains (id, key, name, symbol, explorer_url, environment, rpc_env_var, capabilities, confirmations)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`, [c.id, c.key, c.name, c.symbol, c.explorerUrl, c.environment || 'mainnet', c.rpcEnvVar, c.capabilities, c.confirmations])
    await db.q(`INSERT INTO integrations (id, key, name, type, endpoint_ref, permitted_chains) VALUES ($1,$2,$3,'rpc',$4,$5) ON CONFLICT (key) DO NOTHING`, [newId('int'), `rpc:${c.id}`, `${c.name} JSON-RPC`, c.rpcEnvVar, [c.id]])
  }
  for (const t of CANONICAL_TOKENS) {
    await db.q(`INSERT INTO tokens (id, chain_id, address, symbol, name, decimals, is_canonical) VALUES ($1,$2,$3,$4,$5,$6,true)
      ON CONFLICT (chain_id, address) DO UPDATE SET is_canonical = true, symbol = EXCLUDED.symbol, decimals = EXCLUDED.decimals`, [newId('tok'), t.chainId, t.address, t.symbol, t.name, t.decimals])
  }
  for (const [key, r] of Object.entries(STAFF_ROLES)) {
    await db.q(`INSERT INTO platform_staff_roles (key, name, capabilities) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET capabilities = EXCLUDED.capabilities, name = EXCLUDED.name`, [key, r.name, r.caps])
  }
  const plans = PLANS.map((x) => [x.key, x.name, x.priceMonthlyCents, x.entitlements])
  for (const [key, name, cents, ent] of plans) await db.q(`INSERT INTO plans (key, name, price_monthly_cents, entitlements) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING`, [key, name, cents, JSON.stringify(ent)])
  const integrations = [
    ['indexer:etherscan', 'Etherscan V2 indexer', 'indexer', 'ETHERSCAN_API_KEY'], ['graph:tigergraph', 'TigerGraph', 'graph', 'TIGERGRAPH_HOST'],
    ['ai:llm', 'AI explanation provider', 'ai', 'AI_PROVIDER'], ['ai:embeddings', 'Embedding provider', 'ai', 'EMBEDDING_PROVIDER'],
    ['payments:dodo', 'Dodo Payments', 'payments', 'DODO_API_KEY'], ['email', 'Email delivery', 'email', 'EMAIL_PROVIDER'],
    ['contract:proof-registry', 'Proof registry contract', 'contract', 'PROOF_REGISTRY_ADDRESS'], ['queue:redis', 'Job queue (Redis/BullMQ)', 'queue', 'REDIS_URL'],
  ]
  for (const [key, name, type, ref] of integrations) await db.q(`INSERT INTO integrations (id, key, name, type, endpoint_ref) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING`, [newId('int'), key, name, type, ref])
  const flags = [['ai_explanations', 'AI finding explanations'], ['ask_poisonguard', 'Ask PoisonGuard assistant'], ['proof_anchoring', 'On-chain proof anchoring'],
    ['tigergraph_sync', 'TigerGraph graph sync'], ['platform_help_ai', 'Generative answers on public help'], ['billing', 'Billing & checkout'], ['multilingual', 'Multilingual UI content']]
  for (const [key, name] of flags) await db.q(`INSERT INTO feature_flags (id, key, name) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING`, [newId('ff'), key, name])
  for (const [ruleId, r] of Object.entries(RULES)) {
    await db.q(`INSERT INTO detection_rules (id, rule_id, version, name, category, description, default_severity, thresholds, known_false_positives)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (rule_id, version) DO NOTHING`, [newId('rul'), ruleId, METHODOLOGY_VERSION, r.name, r.category, r.description, r.defaultSeverity, JSON.stringify(r.thresholds), r.knownFalsePositives])
  }
  await db.q(`INSERT INTO methodology_versions (id, version, title, changes, status, effective_at) VALUES ($1,$2,$3,$4,'published', now()) ON CONFLICT (version) DO NOTHING`,
    [newId('mth'), METHODOLOGY_VERSION, `Detection rules v${METHODOLOGY_VERSION}`, 'Initial deterministic rule set: lookalike counterparty, zero-value spoofing, dust burst, counterfeit token, unlimited allowance, allowance to EOA.'])
  const settings = [['retention.scan_ip_hash_days', 30], ['retention.report_contact_days', 180], ['security.login_lockout_attempts', 5], ['security.staff_session_hours', 8],
    ['rate_limits.public_scans_per_minute', 12], ['domains.official', ['poisonguard.app']], ['incident.contacts', []]]
  const { ingestPlatformKnowledge } = await import('../modules/knowledge/platform-corpus.js')
  await ingestPlatformKnowledge()
  for (const [k, v] of settings) await db.q(`INSERT INTO platform_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [k, JSON.stringify(v)])
}
