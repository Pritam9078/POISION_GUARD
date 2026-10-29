import { db, tx } from '../../db/index.js'
import { svc } from '../../services/registry.js'
import { chainById } from '../../shared/chains.js'
import { ERC20, TRANSFER_TOPIC } from '../../adapters/chains/evm.js'
import { assertTransition } from '../../shared/states.js'
import { audit } from '../audit/audit.service.js'
import { notify } from '../notifications/notify.service.js'
import { openIncident } from '../incidents/incidents.service.js'

/**
 * Compare what actually happened on chain with what was approved. Approval ≠ signature ≠ confirmation.
 * Returns { done, status, reconciliation }. Not-yet-mined attempts are retried (job re-enqueued).
 */
export async function reconcileAttempt({ attemptId }) {
  const att = await db.one('SELECT * FROM execution_attempts WHERE id = $1', [attemptId])
  if (!att || att.status !== 'submitted') return { done: true, skipped: true }
  const intent = await db.one('SELECT * FROM spend_intents WHERE id = $1', [att.intentId])
  const adapter = svc('chains').adapter(intent.chainId)
  if (!adapter) return { done: false, reason: 'RPC_NOT_CONFIGURED' }
  const [t, r] = await Promise.all([adapter.getTransaction(att.txHash).catch(() => null), adapter.getTransactionReceipt(att.txHash).catch(() => null)])
  if (!t || !r) {
    const ageMin = (Date.now() - new Date(att.createdAt).getTime()) / 60000
    if (ageMin > 24 * 60) return finish(intent, att, 'failed', 'failed', 'Transaction not found on chain after 24h; marked failed. Re-prepare to retry.')
    await db.update('execution_attempts', { id: att.id }, { checkedAt: new Date(), reconciliation: 'Awaiting inclusion' })
    await svc('jobs').enqueue('intent.reconcile', { attemptId }, { delay: 30000 }).catch(() => {})
    return { done: false, status: 'pending' }
  }
  const head = await adapter.getBlockNumber()
  const confs = head - Number(r.blockNumber) + 1
  if (confs < chainById(intent.chainId).confirmations) {
    await db.update('execution_attempts', { id: att.id }, { checkedAt: new Date(), blockNumber: r.blockNumber, reconciliation: `Mined; ${confs} confirmation(s), waiting for finality` })
    await svc('jobs').enqueue('intent.reconcile', { attemptId }, { delay: 30000 }).catch(() => {})
    return { done: false, status: 'awaiting_finality' }
  }
  if (r.status !== 1) return finish(intent, att, 'reverted', 'reverted', `Receipt status 0 in block ${r.blockNumber}; no funds moved.`, r.blockNumber)

  const problems = []
  if (t.from.toLowerCase() !== intent.fromAddress) problems.push(`sender ${t.from} ≠ approved wallet ${intent.fromAddress}`)
  if (intent.assetType === 'native') {
    if (t.to?.toLowerCase() !== intent.toAddress) problems.push(`recipient ${t.to} ≠ approved ${intent.toAddress}`)
    if (BigInt(t.value) !== BigInt(intent.amount)) problems.push(`value ${t.value} ≠ approved ${intent.amount}`)
  } else {
    if (t.to?.toLowerCase() !== intent.tokenAddress) problems.push(`called contract ${t.to} ≠ token ${intent.tokenAddress}`)
    try {
      const [to, amt] = ERC20.decodeFunctionData('transfer', t.data)
      if (to.toLowerCase() !== intent.toAddress) problems.push(`transfer() recipient ${to} ≠ approved ${intent.toAddress}`)
      if (BigInt(amt) !== BigInt(intent.amount)) problems.push(`transfer() amount ${amt} ≠ approved ${intent.amount}`)
    } catch { problems.push('calldata is not ERC-20 transfer(to, amount)') }
    const logs = (r.logs || []).filter((l) => l.address?.toLowerCase() === intent.tokenAddress && l.topics?.[0] === TRANSFER_TOPIC)
    const received = logs.filter((l) => ('0x' + l.topics[2].slice(26)).toLowerCase() === intent.toAddress).reduce((s, l) => s + BigInt(l.data), 0n)
    if (received !== BigInt(intent.amount)) problems.push(`recipient received ${received} per Transfer logs ≠ approved ${intent.amount} (fee-on-transfer or partial)`)
  }
  if (problems.length) return finish(intent, att, 'mismatch', 'reconciliation_mismatch', `MISMATCH: ${problems.join('; ')}`, r.blockNumber)
  return finish(intent, att, 'confirmed', 'confirmed', `Receipt status 1 in block ${r.blockNumber} with ${confs} confirmations; sender, recipient, asset and amount match the approved parameters.`, r.blockNumber)
}

async function finish(intent, att, attStatus, intentStatus, note, blockNumber = null) {
  await tx(async (c) => {
    await c.update('execution_attempts', { id: att.id }, { status: attStatus, reconciliation: note, checkedAt: new Date(), blockNumber })
    assertTransition('intent', 'submitted', intentStatus)
    await c.q(`UPDATE spend_intents SET status = $1, updated_at = now() WHERE id = $2 AND status = 'submitted'`, [intentStatus, intent.id])
    await audit(c, { workspaceId: intent.workspaceId, actor: { type: 'system', label: 'reconciler' }, action: `spend_intent.reconcile.${intentStatus}`, target: { type: 'spend_intent', id: intent.id }, metadata: { txHash: att.txHash, note } })
    await notify(c, intent.workspaceId, { type: intentStatus === 'confirmed' ? 'execution_confirmed' : 'execution_problem', title: intentStatus === 'confirmed' ? 'Execution confirmed' : `Execution ${intentStatus.replace('_', ' ')}`, body: `${intent.id}: ${note}`, refType: 'spend_intent', refId: intent.id })
    if (intentStatus === 'reconciliation_mismatch') await openIncident(c, { workspaceId: intent.workspaceId, type: 'spend', category: 'reconciliation_mismatch', severity: 'high', title: `Reconciliation mismatch on ${intent.id}`, description: note, sourceRef: intent.id, evidence: { txHash: att.txHash } })
  })
  return { done: true, status: intentStatus, reconciliation: note }
}
