import { db } from '../../db/index.js'
import { checksum } from '../../shared/validate.js'
import { chainById } from '../../shared/chains.js'
import { svc } from '../../services/registry.js'
import { similarity } from '../scanner/rules.js'
import { env } from '../../config/env.js'
import { explorerAddr } from '../scanner/scan.service.js'

/**
 * Pre-send recipient check. Result is clear | suspicious | inconclusive — never "safe".
 * Sources: prior PoisonGuard findings, sender's own outgoing history (optional), workspace trusted list (Guard only), contract code.
 */
export async function checkRecipient({ chainId, address, senderAddress, expectedLabel, contextTxHash, workspaceId }) {
  const chain = chainById(chainId)
  const adapter = svc('chains').adapter(chainId)
  const evidence = [], coverage = [], matches = []
  let suspicious = false, clearSignal = false, isContract = null

  if (adapter) {
    try { const code = await adapter.getCode(address); isContract = !!code && code !== '0x'; coverage.push({ source: 'EVM RPC', status: 'covered', note: 'Contract code read' }) }
    catch (e) { coverage.push({ source: 'EVM RPC', status: 'unavailable', note: e.message }) }
  } else coverage.push({ source: 'EVM RPC', status: 'unavailable', note: `No RPC configured for ${chain.name}` })

  // 1. Prior evidence-backed findings naming this address (excluding findings reviewed as false positive)
  const flagged = await db.q(`SELECT f.id, f.rule_id, f.severity, f.scan_id, f.created_at FROM findings f JOIN scans s ON s.id = f.scan_id
    WHERE f.related_address = $1 AND s.chain_id = $2 AND f.review_status NOT IN ('false_positive','duplicate') AND f.rule_id LIKE 'PG-POISON-%' ORDER BY f.created_at DESC LIMIT 20`, [address, chainId])
  coverage.push({ source: 'PoisonGuard finding history', status: 'covered', note: `${flagged.length} prior poisoning finding(s) reference this address` })
  if (flagged.length) {
    suspicious = true
    evidence.push({ kind: 'derived', label: 'Prior findings', source: 'PoisonGuard scans', value: `${flagged.length} poisoning finding(s), latest ${flagged[0].ruleId} (${flagged[0].severity}) in scan ${flagged[0].scanId}` })
  }

  // 2. Workspace trusted recipients (Guard only)
  let expectedLabelMatch = null
  if (workspaceId) {
    const trusted = await db.q(`SELECT id, label, address, status FROM trusted_recipients WHERE workspace_id = $1 AND chain_id = $2 AND status = 'active' AND (expires_at IS NULL OR expires_at > now())`, [workspaceId, chainId])
    coverage.push({ source: 'Workspace trusted recipients', status: 'covered', note: `${trusted.length} active trusted recipient(s) compared` })
    const exact = trusted.find((t) => t.address === address)
    if (exact) {
      clearSignal = true
      matches.push({ type: 'trusted_exact', address: exact.address, label: exact.label, recipientId: exact.id })
      evidence.push({ kind: 'derived', label: 'Trusted recipient', source: 'Workspace list', value: `Exact match: "${exact.label}"` })
      if (expectedLabel) expectedLabelMatch = exact.label.trim().toLowerCase() === expectedLabel.trim().toLowerCase()
    }
    for (const t of trusted) {
      const sim = similarity(address, t.address)
      if (sim.strength) {
        suspicious = true
        matches.push({ type: 'trusted_lookalike', address: t.address, label: t.label, prefix: sim.prefix, suffix: sim.suffix, strength: sim.strength })
        evidence.push({ kind: 'derived', label: 'Lookalike of trusted recipient', source: 'PG-POISON-001 similarity', value: `Shares first ${sim.prefix} / last ${sim.suffix} chars with "${t.label}" (${t.address}) but is a different address` })
        if (expectedLabel && t.label.trim().toLowerCase() === expectedLabel.trim().toLowerCase()) expectedLabelMatch = false
      }
    }
  } else coverage.push({ source: 'Workspace trusted recipients', status: 'unavailable', note: 'Sign in to Guard to compare against your trusted list' })

  // 3. Sender's established counterparties (bounded log window, or indexer)
  if (senderAddress && adapter) {
    try {
      const indexer = svc('chains').indexer()
      let transfers
      if (indexer?.configured) transfers = (await indexer.getTokenTransfers(chainId, senderAddress)).transfers
      else { const head = await adapter.getBlockNumber(); transfers = await adapter.getTransferHistory(senderAddress, { fromBlock: Math.max(0, head - env.SCAN_LOG_BLOCK_RANGE), toBlock: head }) }
      const paid = new Set(transfers.filter((t) => t.from === senderAddress && BigInt(t.value) > 0n).map((t) => t.to))
      coverage.push({ source: 'Sender history', status: indexer?.configured ? 'covered' : 'partial', note: `${paid.size} distinct addresses the sender has paid${indexer?.configured ? '' : ` (last ${env.SCAN_LOG_BLOCK_RANGE} blocks)`}` })
      if (paid.has(address)) { clearSignal = true; matches.push({ type: 'previously_paid', address }); evidence.push({ kind: 'onchain_fact', label: 'Previously paid', source: 'Sender history', value: 'The sender has sent value to this exact address before' }) }
      for (const p of paid) {
        const sim = similarity(address, p)
        if (sim.strength) { suspicious = true; matches.push({ type: 'history_lookalike', address: p, prefix: sim.prefix, suffix: sim.suffix, strength: sim.strength }); evidence.push({ kind: 'derived', label: 'Lookalike of a past recipient', source: 'PG-POISON-001 similarity', value: `Resembles ${p} (prefix ${sim.prefix}, suffix ${sim.suffix}) — you have paid that address, not this one` }) }
      }
    } catch (e) { coverage.push({ source: 'Sender history', status: 'unavailable', note: e.message }) }
  }

  // 4. Context transaction
  let contextVerified = false
  if (contextTxHash && adapter) {
    const r = await adapter.getTransactionReceipt(contextTxHash).catch(() => null)
    if (r) {
      contextVerified = true
      const mentioned = (r.logs || []).some((l) => l.topics?.some((t) => t.toLowerCase().endsWith(address.slice(2))))
      evidence.push({ kind: 'onchain_fact', label: 'Context transaction', source: 'Receipt', value: mentioned ? 'Address appears in the context transaction logs' : 'Address does not appear in the context transaction logs' })
    } else coverage.push({ source: 'Context transaction', status: 'unavailable', note: 'Receipt not found on this network' })
  }

  const result = suspicious ? 'suspicious' : clearSignal ? 'clear' : 'inconclusive'
  const strongest = matches.filter((m) => m.prefix).sort((a, b) => b.prefix + b.suffix - (a.prefix + a.suffix))[0]
  return {
    address, checksumAddress: checksum(address), chainId, network: chain.key, result,
    riskLevel: result === 'suspicious' ? (strongest?.strength === 'strong' || flagged.length ? 'CRITICAL' : 'HIGH') : result === 'clear' ? 'LOW' : 'UNKNOWN',
    isKnownLookalike: suspicious, similarityScore: strongest ? +((strongest.prefix + strongest.suffix) / 40).toFixed(2) : null,
    isContract, matches, evidence, coverage, expectedLabelMatch, contextVerified,
    verdict: result === 'suspicious'
      ? 'Potential address-poisoning lookalike. Do not send until you verify the full address through an independent channel.'
      : result === 'clear'
        ? 'Exact match with a known counterparty and no poisoning evidence found. This is not a guarantee the recipient is trustworthy.'
        : 'No poisoning evidence and no prior relationship found in available data. Inconclusive — verify the recipient independently.',
    recommendations: [
      'Confirm the full address with the recipient over a separate, trusted channel.',
      'Send a small test amount first for new recipients.',
      ...(suspicious ? ['Do not copy this address from transaction history.'] : []),
    ],
    expectedLabelNote: expectedLabel ? 'Labels you type are never treated as proof of ownership.' : undefined,
    explorerUrl: explorerAddr(chainId, address), checkedAt: new Date().toISOString(),
  }
}
