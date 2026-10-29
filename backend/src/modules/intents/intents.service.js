import { db, tx, J } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { sha256, canonicalJson } from '../../shared/crypto.js'
import { canonicalToken } from '../../shared/chains.js'
import { assertTransition, INTENT_EDITABLE, INTENT_TERMINAL } from '../../shared/states.js'
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors.js'
import { roleCan } from '../../shared/permissions.js'
import { svc } from '../../services/registry.js'
import { ERC20 } from '../../adapters/chains/evm.js'
import { evaluate } from '../policies/engine.js'
import { similarity } from '../scanner/rules.js'
import { audit } from '../audit/audit.service.js'
import { notify } from '../notifications/notify.service.js'
import { openIncident } from '../incidents/incidents.service.js'

/** The exact parameters an approval binds to. Any change produces a different hash and voids prior approvals. */
export const paramsHashOf = (i) => sha256(canonicalJson({ chainId: i.chainId, from: i.fromAddress, to: i.toAddress, assetType: i.assetType, token: i.tokenAddress ?? null, amount: String(i.amount), walletId: i.walletId }))

async function resolveAsset(chainId, assetType, tokenAddress) {
  if (assetType === 'native') return { symbol: null, decimals: 18 }
  const canon = canonicalToken(chainId, tokenAddress)
  if (canon) return { symbol: canon.symbol, decimals: canon.decimals }
  const t = await db.one('SELECT symbol, decimals FROM tokens WHERE chain_id = $1 AND address = $2', [chainId, tokenAddress])
  if (t) return t
  const a = svc('chains').adapter(chainId)
  const m = a ? await a.getTokenMetadata(tokenAddress).catch(() => null) : null
  if (!m?.decimals && m?.decimals !== 0) throw badRequest('Token metadata could not be verified on chain; cannot create an intent for an unverified token')
  return { symbol: m.symbol, decimals: m.decimals }
}

/** actor: { type: 'user'|'agent', userId?, agent? } */
export async function createIntent(wsId, actor, b) {
  const wallet = await db.one(`SELECT * FROM watched_wallets WHERE id = $1 AND workspace_id = $2 AND status <> 'removed'`, [b.walletId, wsId])
  if (!wallet) throw notFound('Controlled wallet')
  if (wallet.chainId !== b.chainId) throw badRequest(`Wallet is registered on chain ${wallet.chainId}, not ${b.chainId}`)
  if (b.assetType === 'erc20' && !b.tokenAddress) throw badRequest('tokenAddress is required for erc20 intents')
  if (b.toAddress === wallet.address) throw badRequest('Recipient equals the sending wallet')
  const asset = await resolveAsset(b.chainId, b.assetType, b.tokenAddress)
  const chain = (await import('../../shared/chains.js')).chainById(b.chainId)
  const draft = {
    walletId: wallet.id, chainId: b.chainId, fromAddress: wallet.address, toAddress: b.toAddress, assetType: b.assetType,
    tokenAddress: b.assetType === 'erc20' ? b.tokenAddress : null, amount: b.amount,
  }
  const paramsHash = paramsHashOf(draft)
  const idem = b.idempotencyKey || sha256(`${actor.type}:${actor.userId || actor.agent?.id}:${paramsHash}:${b.purpose}:${b.reference ?? ''}`).slice(0, 40)
  const existing = await db.one('SELECT * FROM spend_intents WHERE workspace_id = $1 AND idempotency_key = $2', [wsId, idem])
  if (existing) {
    if (existing.paramsHash !== paramsHash) throw conflict('Idempotency key reused with different parameters', 'IDEMPOTENCY_CONFLICT')
    return { intent: existing, replayed: true }
  }
  const intent = await tx(async (c) => {
    const row = await c.insert('spend_intents', {
      id: newId('int'), workspaceId: wsId, ...draft, agentId: actor.agent?.id ?? null, requestedByUserId: actor.userId ?? null,
      assetSymbol: asset.symbol || (b.assetType === 'native' ? chain.symbol : 'TOKEN'), decimals: asset.decimals,
      purpose: b.purpose, reference: b.reference ?? null, evidenceNote: b.evidence ?? null, expiresAt: b.expiresAt ? new Date(b.expiresAt) : new Date(Date.now() + 72 * 3600_000),
      status: 'draft', paramsHash, idempotencyKey: idem,
    })
    await audit(c, { workspaceId: wsId, actor: actorAudit(actor), action: 'spend_intent.create', target: { type: 'spend_intent', id: row.id }, metadata: { amount: row.amount, asset: row.assetSymbol, to: row.toAddress, paramsHash } })
    return row
  })
  return { intent, replayed: false }
}

const actorAudit = (a) => (a.type === 'agent' ? { type: 'agent', id: a.agent.id, label: `agent:${a.agent.name}` } : { type: 'user', id: a.userId, label: a.label || 'user' })

/** Sum of amounts already committed (approved and later, plus pending) within the window. */
async function spentFn(wsId, intentId) {
  const rows = await db.q(`SELECT agent_id, wallet_id, chain_id, asset_type, token_address, amount, created_at FROM spend_intents
    WHERE workspace_id = $1 AND id <> $2 AND status IN ('pending_approval','approved','ready_to_sign','submitted','confirmed','reconciliation_mismatch') AND created_at > now() - interval '31 days'`, [wsId, intentId])
  return (key, chainId, hours, scope) => {
    const since = Date.now() - hours * 3600_000
    return rows.filter((r) => r.chainId === chainId && (r.assetType === 'native' ? 'native' : r.tokenAddress) === key && new Date(r.createdAt).getTime() >= since
      && (!scope.agentId || r.agentId === scope.agentId) && (!scope.walletId || r.walletId === scope.walletId)).reduce((s, r) => s + BigInt(r.amount), 0n)
  }
}

async function activePolicies(wsId) {
  return (await db.q(`SELECT p.id AS policy_id, p.name, pv.id AS version_id, pv.version, pv.config FROM policies p JOIN policy_versions pv ON pv.id = p.active_version_id
    WHERE p.workspace_id = $1 AND p.status = 'active' ORDER BY p.priority, p.created_at`, [wsId])).map((r) => ({ policyId: r.policyId, name: r.name, versionId: r.versionId, version: r.version, config: r.config }))
}

/** Gathers deterministic evidence about the recipient. Used by evaluation and by the simulator. */
export async function counterpartyContext(wsId, chainId, toAddress) {
  const trusted = await db.q(`SELECT id, address, label FROM trusted_recipients WHERE workspace_id = $1 AND chain_id = $2 AND status = 'active' AND (expires_at IS NULL OR expires_at > now())`, [wsId, chainId])
  const recipientFindings = await db.q(`SELECT f.id, f.rule_id, f.severity, f.scan_id FROM findings f JOIN scans s ON s.id = f.scan_id
    WHERE f.related_address = $1 AND s.chain_id = $2 AND f.review_status NOT IN ('false_positive','duplicate') ORDER BY f.created_at DESC LIMIT 25`, [toAddress, chainId])
  const lookalikeOfTrusted = trusted.filter((t) => t.address !== toAddress && similarity(toAddress, t.address).strength).map((t) => ({ address: t.address, label: t.label }))
  const adapter = svc('chains').adapter(chainId)
  let isContract = null, intelligenceAvailable = !!adapter
  if (adapter) { try { const code = await adapter.getCode(toAddress); isContract = code !== '0x' } catch { intelligenceAvailable = false } }
  return { trusted, recipientFindings, lookalikeOfTrusted, intelligenceAvailable, isContract, capturedAt: new Date().toISOString() }
}

export async function loadAgent(agentId) {
  if (!agentId) return null
  return db.one('SELECT * FROM agents WHERE id = $1', [agentId])
}

export async function evaluateIntent(wsId, intentId, actor) {
  const intent = await db.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2', [intentId, wsId])
  if (!intent) throw notFound('Spend intent')
  await expireIfNeeded(intent)
  if (intent.status !== 'draft') throw conflict(`Intent is ${intent.status}; only drafts can be evaluated`, 'INVALID_STATE_TRANSITION')
  const [policies, ctx, spent, agent] = await Promise.all([activePolicies(wsId), counterpartyContext(wsId, intent.chainId, intent.toAddress), spentFn(wsId, intent.id), loadAgent(intent.agentId)])
  const outcome = evaluate(intent, policies, { ...ctx, spent, agent, now: new Date() })
  const next = outcome.decision === 'deny' ? 'denied' : outcome.decision === 'require_approval' ? 'pending_approval' : 'approved'
  const evalId = newId('pev')
  const updated = await tx(async (c) => {
    await c.insert('policy_evaluations', { id: evalId, workspaceId: wsId, intentId: intent.id, policyVersionIds: outcome.policyVersionIds, paramsHash: intent.paramsHash, input: J({ intent: pick(intent), context: ctx }), results: J(outcome.results), decision: outcome.decision, reasonCodes: outcome.reasonCodes, requiredApprovals: outcome.requiredApprovals })
    assertTransition('intent', 'draft', 'evaluated'); assertTransition('intent', 'evaluated', next)
    const row = await c.one(`UPDATE spend_intents SET status = $1, last_evaluation_id = $2, required_approvals = $3, counterparty_snapshot = $4, updated_at = now() WHERE id = $5 AND status = 'draft' RETURNING *`,
      [next, evalId, outcome.requiredApprovals, JSON.stringify(ctx), intent.id])
    if (!row) throw conflict('Intent changed concurrently; re-evaluate', 'CONCURRENT_MODIFICATION')
    await audit(c, { workspaceId: wsId, actor: actor ? actorAudit(actor) : { type: 'system', label: 'policy-engine' }, action: `spend_intent.evaluate.${outcome.decision}`, target: { type: 'spend_intent', id: intent.id }, metadata: { evaluationId: evalId, reasonCodes: outcome.reasonCodes, requiredApprovals: outcome.requiredApprovals, policyVersionIds: outcome.policyVersionIds } })
    if (intent.agentId) await c.insert('agent_requests', { id: newId('arq'), agentId: intent.agentId, workspaceId: wsId, tool: 'propose_transfer', outcome: next === 'denied' ? 'blocked' : next === 'approved' ? 'allowed' : 'pending', reason: outcome.reasonCodes.join(', ') || 'policy evaluation', intentId: intent.id, detail: J({ amount: intent.amount, asset: intent.assetSymbol, to: intent.toAddress }) })
    if (next === 'pending_approval') await notify(c, wsId, { type: 'approval_required', title: 'Approval required', body: `Spend intent ${intent.id} (${intent.amount} base units ${intent.assetSymbol}) needs ${outcome.requiredApprovals} approval(s).`, refType: 'spend_intent', refId: intent.id })
    if (next === 'denied') {
      await notify(c, wsId, { type: 'spend_blocked', title: 'Spend intent denied by policy', body: `${intent.id}: ${outcome.reasonCodes.join(', ')}`, refType: 'spend_intent', refId: intent.id })
      if (intent.agentId) {
        const recent = await c.one(`SELECT count(*)::int AS n FROM agent_requests WHERE agent_id = $1 AND outcome = 'blocked' AND created_at > now() - interval '24 hours'`, [intent.agentId])
        if (recent.n >= 3) await openIncident(c, { workspaceId: wsId, type: 'security', category: 'repeated_authorization_denials', severity: 'high', title: 'Repeated blocked agent spend requests', description: `Agent ${intent.agentId} had ${recent.n} blocked requests in 24h. Consider freezing the agent.`, sourceRef: intent.agentId, dedupeHours: 24 })
      }
    }
    return row
  })
  return { intent: updated, evaluation: { id: evalId, ...outcome } }
}
const pick = (i) => ({ id: i.id, walletId: i.walletId, agentId: i.agentId, chainId: i.chainId, fromAddress: i.fromAddress, toAddress: i.toAddress, assetType: i.assetType, tokenAddress: i.tokenAddress, amount: i.amount, paramsHash: i.paramsHash })

async function expireIfNeeded(intent) {
  if (intent.expiresAt && new Date(intent.expiresAt) < new Date() && !INTENT_TERMINAL.includes(intent.status) && intent.status !== 'submitted') {
    await db.q(`UPDATE spend_intents SET status = 'expired', updated_at = now() WHERE id = $1`, [intent.id])
    await audit(null, { workspaceId: intent.workspaceId, actor: { type: 'system', label: 'expiry' }, action: 'spend_intent.expire', target: { type: 'spend_intent', id: intent.id } })
    throw conflict('Intent has expired', 'INTENT_EXPIRED')
  }
}

export async function validApprovals(c, intent) {
  return c.q(`SELECT * FROM approvals WHERE intent_id = $1 AND decision = 'approved' AND params_hash = $2 AND invalidated_at IS NULL`, [intent.id, intent.paramsHash])
}

/** Approve/reject. Server-enforced: capability, no self-approval, agent-owner separation, distinct approvers, param binding. */
export async function decide(ws, intentId, user, { decision, reason }) {
  if (decision === 'rejected' && (!reason || reason.trim().length < 3)) throw badRequest('A reason is required to reject')
  if (!roleCan(ws.membership.role, 'intents.approve')) throw forbidden('Your role cannot approve or reject spend intents')
  return tx(async (c) => {
    const intent = await c.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [intentId, ws.id])
    if (!intent) throw notFound('Spend intent')
    await expireIfNeeded(intent)
    if (intent.status !== 'pending_approval') throw conflict(`Intent is ${intent.status}, not pending approval`, 'INVALID_STATE_TRANSITION')
    if (intent.requestedByUserId === user.id) throw forbidden('You cannot approve or reject an intent you requested (separation of duties)')
    const ev = await c.one('SELECT results FROM policy_evaluations WHERE id = $1', [intent.lastEvaluationId])
    if (intent.agentId) {
      const ag = await c.one('SELECT owner_user_id FROM agents WHERE id = $1', [intent.agentId])
      // Default is NO: agent owners may approve their agent's spend only if every applied policy explicitly allows it.
      const versionIds = (await c.one('SELECT policy_version_ids FROM policy_evaluations WHERE id = $1', [intent.lastEvaluationId]))?.policyVersionIds || []
      const cfgs = versionIds.length ? await c.q(`SELECT pv.config FROM policy_versions pv WHERE pv.id = ANY($1)`, [versionIds]) : []
      const allowOwner = cfgs.length > 0 && cfgs.every((r) => r.config?.approvals?.allowAgentOwner === true)
      if (ag?.ownerUserId === user.id && !allowOwner) throw forbidden('Agent owners cannot approve their own agent’s spend (separation of duties)')
    }
    const dup = await c.one('SELECT id FROM approvals WHERE intent_id = $1 AND approver_user_id = $2 AND params_hash = $3', [intent.id, user.id, intent.paramsHash])
    if (dup) throw conflict('You have already recorded a decision for these exact parameters', 'DUPLICATE_APPROVAL')
    await c.insert('approvals', { id: newId('apv'), intentId: intent.id, approverUserId: user.id, decision, reason: reason || '', paramsHash: intent.paramsHash })
    let status = intent.status
    if (decision === 'rejected') { assertTransition('intent', status, 'denied'); status = 'denied' }
    else {
      const n = (await validApprovals(c, intent)).length
      if (n >= intent.requiredApprovals) { assertTransition('intent', status, 'approved'); status = 'approved' }
    }
    const row = await c.update('spend_intents', { id: intent.id }, { status })
    await audit(c, { workspaceId: ws.id, actor: { type: 'user', id: user.id, label: user.name }, action: `spend_intent.${decision === 'approved' ? 'approve' : 'reject'}`, target: { type: 'spend_intent', id: intent.id }, metadata: { paramsHash: intent.paramsHash, reason, resultingStatus: status, evaluationRules: ev?.results?.length } })
    if (status === 'approved') await notify(c, ws.id, { type: 'intent_approved', title: 'Spend intent approved', body: `${intent.id} reached its approval threshold. It still needs to be prepared and signed in the authorized wallet.`, refType: 'spend_intent', refId: intent.id })
    return row
  })
}

/** Edit parameters. Any change voids approvals and returns the intent to draft for re-evaluation. */
export async function updateParams(ws, intentId, actor, patch) {
  return tx(async (c) => {
    const intent = await c.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [intentId, ws.id])
    if (!intent) throw notFound('Spend intent')
    if (!INTENT_EDITABLE.includes(intent.status)) throw conflict(`Intent is ${intent.status} and can no longer be edited`, 'INTENT_LOCKED')
    const next = { ...intent, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) }
    if (patch.tokenAddress !== undefined || patch.assetType !== undefined) Object.assign(next, await resolveAsset(next.chainId, next.assetType, next.tokenAddress).then((a) => ({ assetSymbol: a.symbol || intent.assetSymbol, decimals: a.decimals })))
    const newHash = paramsHashOf(next)
    const changed = newHash !== intent.paramsHash
    const fields = { toAddress: next.toAddress, amount: next.amount, assetType: next.assetType, tokenAddress: next.tokenAddress, purpose: next.purpose, reference: next.reference, paramsHash: newHash, assetSymbol: next.assetSymbol, decimals: next.decimals }
    if (changed) {
      if (intent.status !== 'draft') assertTransition('intent', intent.status, 'draft')
      Object.assign(fields, { status: 'draft', unsignedTx: null, lastEvaluationId: null, requiredApprovals: 0 })
      await c.q('UPDATE approvals SET invalidated_at = now() WHERE intent_id = $1 AND invalidated_at IS NULL', [intent.id])
    }
    const row = await c.update('spend_intents', { id: intent.id }, fields)
    await audit(c, { workspaceId: ws.id, actor: actorAudit(actor), action: changed ? 'spend_intent.params_changed' : 'spend_intent.update', target: { type: 'spend_intent', id: intent.id }, metadata: { previousParamsHash: intent.paramsHash, paramsHash: newHash, approvalsInvalidated: changed, previousStatus: intent.status } })
    return { intent: row, approvalsInvalidated: changed }
  })
}

export async function cancelIntent(ws, intentId, actor, reason) {
  return tx(async (c) => {
    const intent = await c.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [intentId, ws.id])
    if (!intent) throw notFound('Spend intent')
    const mayCancel = intent.requestedByUserId === actor.userId || roleCan(ws.membership.role, 'intents.approve') || roleCan(ws.membership.role, 'agents.manage')
    if (!mayCancel) throw forbidden('Only the requester or an approver/admin can cancel')
    assertTransition('intent', intent.status, 'cancelled')
    const row = await c.update('spend_intents', { id: intent.id }, { status: 'cancelled' })
    await audit(c, { workspaceId: ws.id, actor: actorAudit(actor), action: 'spend_intent.cancel', target: { type: 'spend_intent', id: intent.id }, metadata: { reason } })
    return row
  })
}

/** Builds the unsigned transaction. Re-checks that approvals bind to the current parameters. Never signs. */
export async function prepareIntent(ws, intentId, actor) {
  return tx(async (c) => {
    const intent = await c.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [intentId, ws.id])
    if (!intent) throw notFound('Spend intent')
    await expireIfNeeded(intent)
    if (intent.status !== 'approved') throw conflict(`Intent is ${intent.status}; only approved intents can be prepared`, 'INVALID_STATE_TRANSITION')
    if (paramsHashOf(intent) !== intent.paramsHash) throw conflict('Stored parameters do not match their hash', 'PARAMS_INTEGRITY')
    if (intent.requiredApprovals > 0 && (await validApprovals(c, intent)).length < intent.requiredApprovals) throw conflict('Approvals do not cover the current parameters', 'APPROVALS_STALE')
    const unsigned = intent.assetType === 'native'
      ? { chainId: intent.chainId, from: intent.fromAddress, to: intent.toAddress, value: '0x' + BigInt(intent.amount).toString(16), data: '0x' }
      : { chainId: intent.chainId, from: intent.fromAddress, to: intent.tokenAddress, value: '0x0', data: ERC20.encodeFunctionData('transfer', [intent.toAddress, BigInt(intent.amount)]) }
    assertTransition('intent', 'approved', 'ready_to_sign')
    const row = await c.update('spend_intents', { id: intent.id }, { status: 'ready_to_sign', unsignedTx: unsigned })
    await audit(c, { workspaceId: ws.id, actor: actorAudit(actor), action: 'spend_intent.prepare', target: { type: 'spend_intent', id: intent.id }, metadata: { paramsHash: intent.paramsHash } })
    return { intent: row, unsignedTransaction: unsigned, note: 'Review and sign this exact transaction in the authorized wallet. PoisonGuard does not hold keys and will not broadcast.' }
  })
}

export async function submitIntent(ws, intentId, actor, txHash) {
  const out = await tx(async (c) => {
    const intent = await c.one('SELECT * FROM spend_intents WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [intentId, ws.id])
    if (!intent) throw notFound('Spend intent')
    if (intent.status !== 'ready_to_sign') throw conflict(`Intent is ${intent.status}; only ready_to_sign intents accept a transaction hash`, 'INVALID_STATE_TRANSITION')
    const dup = await c.one('SELECT intent_id FROM execution_attempts WHERE tx_hash = $1', [txHash])
    if (dup) throw conflict('This transaction hash is already linked to an intent', 'TX_ALREADY_LINKED')
    const att = await c.insert('execution_attempts', { id: newId('exa'), intentId: intent.id, txHash, submittedById: actor.userId ?? null, status: 'submitted' })
    assertTransition('intent', 'ready_to_sign', 'submitted')
    const row = await c.update('spend_intents', { id: intent.id }, { status: 'submitted' })
    await audit(c, { workspaceId: ws.id, actor: actorAudit(actor), action: 'spend_intent.submit', target: { type: 'spend_intent', id: intent.id }, metadata: { txHash } })
    return { intent: row, attempt: att }
  })
  await svc('jobs').enqueue('intent.reconcile', { attemptId: out.attempt.id }, { delay: 15000 })
  return out
}

export async function intentDto(i) {
  const [approvals, attempts, evalRow, wallet, agent, users] = await Promise.all([
    db.q('SELECT a.*, u.name AS approver_name FROM approvals a LEFT JOIN users u ON u.id = a.approver_user_id WHERE intent_id = $1 ORDER BY a.created_at', [i.id]),
    db.q('SELECT * FROM execution_attempts WHERE intent_id = $1 ORDER BY created_at', [i.id]),
    i.lastEvaluationId ? db.one('SELECT * FROM policy_evaluations WHERE id = $1', [i.lastEvaluationId]) : null,
    db.one('SELECT label FROM watched_wallets WHERE id = $1', [i.walletId]),
    i.agentId ? db.one('SELECT name FROM agents WHERE id = $1', [i.agentId]) : null,
    i.requestedByUserId ? db.one('SELECT name FROM users WHERE id = $1', [i.requestedByUserId]) : null,
  ])
  const trusted = (i.counterpartySnapshot?.trusted || []).find((t) => t.address === i.toAddress)
  const { chainById } = await import('../../shared/chains.js')
  const fmt = (v, d) => { const b = BigInt(v), base = 10n ** BigInt(d); const f = (b % base).toString().padStart(d, '0').replace(/0+$/, ''); return (b / base).toLocaleString('en-US') + (f ? '.' + f.slice(0, 8) : '') }
  return {
    id: i.id, requester: agent?.name || users?.name || 'unknown', requesterType: i.agentId ? 'agent' : 'user', requestedByUserId: i.requestedByUserId, agentId: i.agentId,
    walletId: i.walletId, walletLabel: wallet?.label, network: chainById(i.chainId)?.key, chainId: i.chainId, fromAddress: i.fromAddress,
    recipient: i.toAddress, recipientLabel: trusted?.label || 'Unrecognized recipient', asset: i.assetSymbol, assetType: i.assetType, tokenAddress: i.tokenAddress,
    amount: fmt(i.amount, i.decimals), amountBaseUnits: i.amount, decimals: i.decimals,
    actionType: i.assetType === 'native' ? 'native.transfer' : 'erc20.transfer', purpose: i.purpose, reference: i.reference, deadline: i.expiresAt, status: i.status,
    paramsHash: i.paramsHash, idempotencyKey: i.idempotencyKey, requiredApprovals: i.requiredApprovals,
    policyResult: evalRow ? { evaluationId: evalRow.id, verdict: evalRow.decision, reasonCodes: evalRow.reasonCodes, policyVersionIds: evalRow.policyVersionIds, evaluatedAt: evalRow.createdAt,
      rules: evalRow.results.map((r) => ({ rule: r.rule, result: r.result, effect: r.effect, detail: r.detail, policy: r.policyName, version: r.version, code: r.code })) } : null,
    approvals: approvals.map((a) => ({ id: a.id, approver: a.approverName, approverUserId: a.approverUserId, decision: a.decision, at: a.createdAt, note: a.reason, boundToCurrentParams: a.paramsHash === i.paramsHash && !a.invalidatedAt, invalidatedAt: a.invalidatedAt })),
    counterpartySnapshot: i.counterpartySnapshot, unsignedTransaction: i.unsignedTx,
    execution: attempts.length ? { attempts: attempts.map((a) => ({ at: a.createdAt, hash: a.txHash, status: a.status, blockNumber: a.blockNumber, reconciliation: a.reconciliation, checkedAt: a.checkedAt })), confirmedAt: attempts.find((a) => a.status === 'confirmed')?.checkedAt ?? null, reconciliation: attempts.at(-1).reconciliation } : null,
    createdAt: i.createdAt, updatedAt: i.updatedAt, evidence: i.evidenceNote,
  }
}
