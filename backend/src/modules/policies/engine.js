/**
 * Deterministic policy engine. Pure function: same input → same decision.
 * Precedence: any DENY → deny; else any REQUIRE_APPROVAL → require_approval (max approvals); else allow.
 * A trusted recipient never overrides a deny condition (blocklist, poisoning evidence, limits).
 * AI output is never an input to this function.
 */
import { z } from 'zod'

const addr = z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((v) => v.toLowerCase())
const units = z.string().regex(/^\d{1,78}$/)
const asset = z.union([z.literal('native'), addr])
const behavior = z.enum(['deny', 'require_approval', 'allow'])

export const policyConfigSchema = z.object({
  appliesTo: z.object({
    walletIds: z.array(z.string()).default([]), agentIds: z.array(z.string()).default([]),
    chainIds: z.array(z.number().int()).default([]), actionTypes: z.array(z.enum(['native.transfer', 'erc20.transfer'])).default([]),
    requesterTypes: z.array(z.enum(['user', 'agent'])).default([]),
  }).prefault({}),
  allowedChains: z.array(z.number().int()).optional(),
  allowedTokens: z.array(asset).optional(),
  limits: z.array(z.object({ asset, chainId: z.number().int(), perTx: units.optional(), perPeriod: units.optional(), periodHours: z.number().int().min(1).max(24 * 31).default(24) })).default([]),
  recipients: z.object({
    mode: z.enum(['allowlist', 'any']).default('any'),
    blocked: z.array(addr).default([]),
    untrusted: behavior.default('require_approval'),
  }).prefault({}),
  risk: z.object({
    denyOnPoisoningFinding: z.boolean().default(true),
    denyOnLookalikeOfTrusted: z.boolean().default(true),
  }).prefault({}),
  intelligenceUnavailable: behavior.default('require_approval'),
  approvals: z.object({
    required: z.number().int().min(0).max(10).default(1),
    thresholds: z.array(z.object({ asset, chainId: z.number().int(), atOrAbove: units, required: z.number().int().min(1).max(10) })).default([]),
    allowAgentOwner: z.boolean().default(false),
  }).prefault({}),
  timeWindow: z.object({ days: z.array(z.number().int().min(0).max(6)).min(1), startHourUtc: z.number().int().min(0).max(23), endHourUtc: z.number().int().min(1).max(24) }).optional(),
  effectivePeriod: z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }).optional(),
}).strict()

export function validatePolicyConfig(cfg) {
  const r = policyConfigSchema.safeParse(cfg)
  if (!r.success) return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || 'config'}: ${i.message}`) }
  const errors = []
  for (const l of r.data.limits) if (!l.perTx && !l.perPeriod) errors.push(`limits: entry for ${l.asset} on ${l.chainId} needs perTx or perPeriod`)
  if (r.data.recipients.mode === 'allowlist' && r.data.recipients.untrusted === 'allow') errors.push('recipients: allowlist mode with untrusted=allow is contradictory')
  if (r.data.timeWindow && r.data.timeWindow.startHourUtc >= r.data.timeWindow.endHourUtc) errors.push('timeWindow: startHourUtc must be before endHourUtc')
  return errors.length ? { ok: false, errors } : { ok: true, config: r.data }
}

const assetKey = (i) => (i.assetType === 'native' ? 'native' : i.tokenAddress)

function applies(cfg, intent) {
  const a = cfg.appliesTo || {}
  if (a.walletIds?.length && !a.walletIds.includes(intent.walletId)) return false
  if (a.agentIds?.length && !a.agentIds.includes(intent.agentId)) return false
  if (a.chainIds?.length && !a.chainIds.includes(intent.chainId)) return false
  if (a.actionTypes?.length && !a.actionTypes.includes(intent.assetType === 'native' ? 'native.transfer' : 'erc20.transfer')) return false
  if (a.requesterTypes?.length && !a.requesterTypes.includes(intent.agentId ? 'agent' : 'user')) return false
  return true
}

/**
 * @param intent { walletId, agentId, chainId, toAddress, assetType, tokenAddress, amount, requestedByUserId }
 * @param policies [{ policyId, versionId, version, name, config }]  (active versions only)
 * @param ctx { trusted: [{address,label}], recipientFindings: [{ruleId, severity}], lookalikeOfTrusted: [{address,label}],
 *              intelligenceAvailable: bool, spent: (assetKey, chainId, hours, scope) => bigint, agent?: {...}, now: Date }
 */
export function evaluate(intent, policies, ctx) {
  const results = []
  const amount = BigInt(intent.amount)
  const key = assetKey(intent)
  const now = ctx.now || new Date()
  let requiredApprovals = 0
  const push = (src, rule, result, effect, detail, code) => results.push({ policyId: src.policyId, policyName: src.name, version: src.version, rule, result, effect, detail, code })

  // Agent-level guardrails act as an implicit, non-removable policy.
  if (intent.agentId && ctx.agent) {
    const src = { policyId: `agent:${ctx.agent.id}`, name: `Agent limits (${ctx.agent.name})`, version: null }
    const ag = ctx.agent
    if (ag.status !== 'active') push(src, 'agent_status', 'fail', 'deny', `Agent is ${ag.status}`, 'AGENT_NOT_ACTIVE')
    if (ag.expiresAt && new Date(ag.expiresAt) <= now) push(src, 'agent_expiry', 'fail', 'deny', 'Agent registration expired', 'AGENT_EXPIRED')
    if (!ag.allowedChains.includes(intent.chainId)) push(src, 'agent_allowed_chains', 'fail', 'deny', `Chain ${intent.chainId} not in agent allowlist`, 'AGENT_CHAIN_NOT_ALLOWED')
    if (!ag.controlledWalletIds.includes(intent.walletId)) push(src, 'agent_controlled_wallets', 'fail', 'deny', 'Wallet not controlled by this agent', 'AGENT_WALLET_NOT_ALLOWED')
    const matchL = (arr) => (arr || []).find((l) => l.asset === key && Number(l.chainId) === intent.chainId)
    const perTx = matchL(ag.perTxLimits)
    if (!perTx) push(src, 'agent_per_tx_limit', 'fail', 'deny', `No per-transaction limit configured for ${key} on chain ${intent.chainId} — agents may only move assets with explicit limits`, 'AGENT_ASSET_NOT_PERMITTED')
    else if (amount > BigInt(perTx.amount)) push(src, 'agent_per_tx_limit', 'fail', 'deny', `${amount} > per-tx limit ${perTx.amount}`, 'AGENT_PER_TX_LIMIT')
    else push(src, 'agent_per_tx_limit', 'pass', null, `${amount} ≤ ${perTx.amount}`)
    const per = matchL(ag.periodLimits)
    if (per) {
      const used = ctx.spent(key, intent.chainId, ag.periodHours, { agentId: ag.id })
      if (used + amount > BigInt(per.amount)) push(src, 'agent_period_limit', 'fail', 'deny', `${used} already committed + ${amount} > ${per.amount} per ${ag.periodHours}h`, 'AGENT_PERIOD_LIMIT')
      else push(src, 'agent_period_limit', 'pass', null, `${used + amount} of ${per.amount} per ${ag.periodHours}h`)
    }
    const th = matchL(ag.approvalThreshold)
    if (th && amount >= BigInt(th.amount)) { push(src, 'agent_approval_threshold', 'warn', 'require_approval', `${amount} ≥ human-approval threshold ${th.amount}`, 'AGENT_APPROVAL_THRESHOLD'); requiredApprovals = Math.max(requiredApprovals, 1) }
  }

  const applicable = policies.filter((p) => applies(p.config, intent))
  if (!applicable.length) {
    results.push({ policyId: null, policyName: 'Workspace default', version: null, rule: 'no_applicable_policy', result: 'warn', effect: 'require_approval', detail: 'No active policy applies; defaulting to one human approval', code: 'NO_POLICY_DEFAULT_REVIEW' })
    requiredApprovals = Math.max(requiredApprovals, 1)
  }

  const trustedExact = ctx.trusted.find((t) => t.address === intent.toAddress)
  for (const p of applicable) {
    const c = p.config
    const src = p
    if (c.effectivePeriod?.from && now < new Date(c.effectivePeriod.from)) continue
    if (c.effectivePeriod?.to && now > new Date(c.effectivePeriod.to)) { push(src, 'effective_period', 'fail', 'deny', 'Policy period ended; intent falls outside the effective window', 'POLICY_PERIOD_ENDED'); continue }

    if (c.allowedChains) c.allowedChains.includes(intent.chainId) ? push(src, 'permitted_networks', 'pass', null, `Chain ${intent.chainId} permitted`) : push(src, 'permitted_networks', 'fail', 'deny', `Chain ${intent.chainId} not permitted`, 'CHAIN_NOT_PERMITTED')
    if (c.allowedTokens) c.allowedTokens.includes(key) ? push(src, 'permitted_tokens', 'pass', null, `${key} permitted`) : push(src, 'permitted_tokens', 'fail', 'deny', `${key} not permitted`, 'TOKEN_NOT_PERMITTED')

    if (c.recipients.blocked.includes(intent.toAddress)) push(src, 'blocked_recipients', 'fail', 'deny', 'Recipient is on the blocklist', 'RECIPIENT_BLOCKED')
    if (trustedExact) push(src, 'recipient_allowlist', 'pass', null, `Trusted recipient "${trustedExact.label}"`)
    else if (c.recipients.mode === 'allowlist') push(src, 'recipient_allowlist', 'fail', c.recipients.untrusted === 'require_approval' ? 'require_approval' : 'deny', 'Recipient is not on the trusted list', 'RECIPIENT_NOT_TRUSTED')
    else if (c.recipients.untrusted !== 'allow') push(src, 'untrusted_recipient', 'warn', c.recipients.untrusted, 'Recipient is not a trusted recipient', 'RECIPIENT_UNTRUSTED')

    const poison = ctx.recipientFindings.filter((f) => f.ruleId.startsWith('PG-POISON') && ['high', 'critical', 'medium'].includes(f.severity))
    if (poison.length) push(src, 'risk_poisoning_evidence', 'fail', c.risk.denyOnPoisoningFinding ? 'deny' : 'require_approval', `${poison.length} poisoning finding(s) reference this recipient`, 'RECIPIENT_POISONING_EVIDENCE')
    if (ctx.lookalikeOfTrusted.length) push(src, 'risk_lookalike_of_trusted', 'fail', c.risk.denyOnLookalikeOfTrusted ? 'deny' : 'require_approval', `Resembles trusted recipient "${ctx.lookalikeOfTrusted[0].label}" but differs`, 'RECIPIENT_LOOKALIKE_OF_TRUSTED')
    if (!ctx.intelligenceAvailable && c.intelligenceUnavailable !== 'allow') push(src, 'intelligence_unavailable', 'warn', c.intelligenceUnavailable, 'Chain data unavailable; recipient could not be fully evaluated', 'INTELLIGENCE_UNAVAILABLE')

    for (const l of c.limits.filter((x) => x.asset === key && x.chainId === intent.chainId)) {
      if (l.perTx) amount > BigInt(l.perTx) ? push(src, 'max_tx', 'fail', 'deny', `${amount} > ${l.perTx}`, 'PER_TX_LIMIT') : push(src, 'max_tx', 'pass', null, `${amount} ≤ ${l.perTx}`)
      if (l.perPeriod) {
        const used = ctx.spent(key, intent.chainId, l.periodHours, { walletId: intent.walletId })
        used + amount > BigInt(l.perPeriod) ? push(src, 'period_limit', 'fail', 'deny', `${used} + ${amount} > ${l.perPeriod} per ${l.periodHours}h`, 'PERIOD_LIMIT') : push(src, 'period_limit', 'pass', null, `${used + amount} of ${l.perPeriod} per ${l.periodHours}h`)
      }
    }

    if (c.timeWindow) {
      const d = now.getUTCDay(), h = now.getUTCHours()
      const inside = c.timeWindow.days.includes(d) && h >= c.timeWindow.startHourUtc && h < c.timeWindow.endHourUtc
      inside ? push(src, 'time_window', 'pass', null, 'Within permitted window') : push(src, 'time_window', 'fail', 'deny', 'Outside permitted time window', 'OUTSIDE_TIME_WINDOW')
    }

    let req = c.approvals.required
    for (const t of c.approvals.thresholds.filter((x) => x.asset === key && x.chainId === intent.chainId)) if (amount >= BigInt(t.atOrAbove)) req = Math.max(req, t.required)
    if (req > 0) { push(src, 'required_approvals', 'warn', 'require_approval', `${req} distinct human approval(s) required`, 'APPROVALS_REQUIRED'); requiredApprovals = Math.max(requiredApprovals, req) }
  }

  const denies = results.filter((r) => r.effect === 'deny')
  const reviews = results.filter((r) => r.effect === 'require_approval')
  for (const r of reviews) if (requiredApprovals < 1) requiredApprovals = 1
  const decision = denies.length ? 'deny' : reviews.length ? 'require_approval' : 'allow'
  const allowAgentOwner = applicable.length ? applicable.every((p) => p.config.approvals.allowAgentOwner) : false
  return {
    decision, requiredApprovals: decision === 'deny' ? 0 : requiredApprovals, allowAgentOwner,
    reasonCodes: [...new Set((denies.length ? denies : reviews).map((r) => r.code).filter(Boolean))],
    results, policyVersionIds: applicable.map((p) => p.versionId),
  }
}
