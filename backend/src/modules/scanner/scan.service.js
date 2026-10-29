import { db, tx } from '../../db/index.js'
import { env } from '../../config/env.js'
import { newId } from '../../shared/ids.js'
import { chainById, canonicalToken, KNOWN_SPENDERS } from '../../shared/chains.js'
import { svc } from '../../services/registry.js'
import { runRules, aggregate, METHODOLOGY_VERSION, RULES, UNLIMITED_THRESHOLD } from './rules.js'
import { assertTransition } from '../../shared/states.js'

const MAX_TOKENS_META = 40
/** Token symbol/name are attacker-controlled on-chain strings: strip control/bidi chars and markup, cap length. */
export function cleanTokenText(v, max) {
  if (v == null) return v
  const t = String(v).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[^\p{L}\p{N} .$_+\-/]/gu, '').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}
const MAX_SPOOF_LOOKUPS = 20
const MAX_APPROVAL_PAIRS = 60

const rpcMissing = (chain) => `No RPC endpoint configured for ${chain.name} (${chain.rpcEnvVar}).`

/** Token metadata with DB cache; canonical registry first. */
export async function tokenMeta(adapter, chainId, tokens) {
  const out = {}
  const uniq = [...new Set(tokens.filter(Boolean))].slice(0, MAX_TOKENS_META)
  if (!uniq.length) return out
  const cached = await db.q('SELECT address, symbol, name, decimals FROM tokens WHERE chain_id = $1 AND address = ANY($2)', [chainId, uniq])
  for (const t of cached) out[t.address] = { ...t, symbol: cleanTokenText(t.symbol, 12), name: cleanTokenText(t.name, 40) }
  for (const t of uniq) {
    if (out[t]) continue
    const canon = canonicalToken(chainId, t)
    let m = canon ? { symbol: canon.symbol, name: canon.name, decimals: canon.decimals } : null
    if (!m && adapter) m = await adapter.getTokenMetadata(t).catch(() => null)
    if (m && m.symbol != null) {
      out[t] = { address: t, symbol: cleanTokenText(m.symbol, 12) || 'UNKNOWN', name: cleanTokenText(m.name ?? '', 40), decimals: m.decimals ?? 18 }
      await db.insert('tokens', { id: newId('tok'), chainId, address: t, symbol: out[t].symbol, name: out[t].name, decimals: out[t].decimals, isCanonical: !!canon }, { onConflict: 'ON CONFLICT (chain_id, address) DO NOTHING' }).catch(() => {})
    }
  }
  return out
}

/**
 * Collect chain data for an address. Every source reports covered/partial/unavailable — nothing is silently skipped.
 */
export async function collectAddressData(chainId, subject, { pinnedBlock } = {}) {
  const chain = chainById(chainId)
  const adapter = svc('chains').adapter(chainId)
  const indexer = svc('chains').indexer()
  const coverage = []
  if (!adapter) {
    coverage.push({ source: 'EVM RPC (read-only)', status: 'unavailable', note: rpcMissing(chain) })
    return { coverage, fatal: 'RPC_NOT_CONFIGURED', transfers: [], approvals: [], tokenMeta: {} }
  }
  const head = pinnedBlock ?? BigInt(await adapter.getBlockNumber())
  coverage.push({ source: 'EVM RPC (read-only)', status: 'covered', note: `Reads pinned at block ${head}`, toBlock: head })
  const fromBlock = head > BigInt(env.SCAN_LOG_BLOCK_RANGE) ? head - BigInt(env.SCAN_LOG_BLOCK_RANGE) : 0n

  let transfers = []
  if (indexer?.configured) {
    try {
      const [tok, nat] = await Promise.all([indexer.getTokenTransfers(chainId, subject), indexer.getNativeTransactions(chainId, subject)])
      transfers = [...tok.transfers, ...nat.transfers].filter((t) => BigInt(t.blockNumber) <= head)
      coverage.push({ source: 'Token transfer history', status: tok.truncated ? 'partial' : 'covered', note: tok.truncated ? 'Indexer returned its 10,000-row cap; older transfers not analysed' : `Full ERC-20 history via indexer (${tok.transfers.length} transfers)` })
      coverage.push({ source: 'Native transaction history', status: nat.truncated ? 'partial' : 'covered', note: `${nat.transfers.length} native transactions via indexer` })
    } catch (e) {
      coverage.push({ source: 'Indexer', status: 'unavailable', note: `Indexer failed: ${e.message}. Falling back to bounded RPC log scan.` })
    }
  }
  if (!transfers.length && !coverage.some((c) => c.source === 'Token transfer history')) {
    try {
      transfers = await adapter.getTransferHistory(subject, { fromBlock: Number(fromBlock), toBlock: Number(head) })
      coverage.push({ source: 'Token transfer history', status: fromBlock > 0n ? 'partial' : 'covered', note: `ERC-20 Transfer logs for blocks ${fromBlock}–${head} via eth_getLogs (${transfers.length} transfers)${fromBlock > 0n ? '; earlier history not analysed' : ''}`, fromBlock, toBlock: head })
    } catch (e) {
      coverage.push({ source: 'Token transfer history', status: 'unavailable', note: `eth_getLogs failed: ${e.message}` })
    }
    coverage.push({ source: 'Native transaction history', status: 'unavailable', note: 'Plain JSON-RPC cannot list an address’s native transactions; configure an indexer (ETHERSCAN_API_KEY).' })
  }

  // Resolve originating sender for zero-value "outgoing" logs (spoof detection needs tx.from).
  const needSender = transfers.filter((t) => t.kind === 'erc20' && t.from === subject && BigInt(t.value) === 0n && !t.txFrom).slice(0, MAX_SPOOF_LOOKUPS)
  await Promise.all(needSender.map(async (t) => { const x = await adapter.getTransaction(t.txHash).catch(() => null); if (x) t.txFrom = x.from.toLowerCase() }))

  const meta = await tokenMeta(adapter, chainId, transfers.map((t) => t.token))
  for (const t of transfers) if (t.tokenSymbol && !meta[t.token]) meta[t.token] = { symbol: cleanTokenText(t.tokenSymbol, 12), decimals: t.tokenDecimals }

  // Approvals: discover via Approval logs in the window, then read CURRENT allowance at the pinned block.
  let approvals = []
  try {
    const events = await adapter.getApprovalHistory(subject, { fromBlock: Number(fromBlock), toBlock: Number(head) })
    const latest = new Map()
    for (const e of events.sort((a, b) => Number(a.blockNumber - b.blockNumber))) latest.set(`${e.token}:${e.spender}`, e)
    const known = await db.q('SELECT token, spender FROM approval_records WHERE chain_id = $1 AND owner = $2', [chainId, subject])
    for (const k of known) if (!latest.has(`${k.token}:${k.spender}`)) latest.set(`${k.token}:${k.spender}`, { token: k.token, spender: k.spender, txHash: null, blockNumber: null })
    const pairs = [...latest.values()].slice(0, MAX_APPROVAL_PAIRS)
    const codeCache = new Map()
    approvals = await Promise.all(pairs.map(async (e) => {
      const allowance = await adapter.getAllowance(e.token, subject, e.spender, Number(head)).catch(() => null)
      if (!codeCache.has(e.spender)) codeCache.set(e.spender, adapter.getCode(e.spender).then((c) => c && c !== '0x').catch(() => null))
      return { token: e.token, spender: e.spender, allowance: allowance == null ? null : allowance.toString(), spenderIsContract: await codeCache.get(e.spender), txHash: e.txHash, grantedBlock: e.blockNumber, lastBlock: head }
    }))
    const unread = approvals.filter((a) => a.allowance == null).length
    approvals = approvals.filter((a) => a.allowance != null)
    Object.assign(meta, await tokenMeta(adapter, chainId, approvals.map((a) => a.token).filter((t) => !meta[t])))
    coverage.push({ source: 'Token approvals', status: fromBlock > 0n || unread ? 'partial' : 'covered', note: `${approvals.length} allowance(s) read with allowance() at block ${head}; discovered from Approval events in blocks ${fromBlock}–${head}${unread ? `; ${unread} could not be read` : ''}. NFT approvals and Permit2 sub-allowances are not supported.` })
  } catch (e) {
    coverage.push({ source: 'Token approvals', status: 'unavailable', note: `Approval discovery failed: ${e.message}` })
  }
  coverage.push({ source: 'Threat intelligence feeds', status: 'unavailable', note: 'No external threat-intel feed is configured; detection is rule-based only.' })
  return { coverage, transfers, approvals, tokenMeta: meta, pinnedBlock: head }
}

async function trustedFor(workspaceId, chainId) {
  if (!workspaceId) return []
  return db.q(`SELECT address, label FROM trusted_recipients WHERE workspace_id = $1 AND chain_id = $2 AND status = 'active' AND (expires_at IS NULL OR expires_at > now())`, [workspaceId, chainId])
}

/** Executes a queued scan end-to-end. Safe to retry: a scan only runs from 'queued'. */
export async function executeScan(scanId) {
  const claimed = await db.one(`UPDATE scans SET status = 'running', started_at = now() WHERE id = $1 AND status = 'queued' RETURNING *`, [scanId])
  if (!claimed) return null
  const scan = claimed
  const t0 = Date.now()
  try {
    const work = scan.subjectType === 'transaction' ? collectTransactionScan(scan) : collectAddressScan(scan)
    const result = await Promise.race([work, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Scan exceeded time budget'), { code: 'SCAN_TIMEOUT' })), env.SCAN_TIMEOUT_MS))])
    await persistResult(scan, result)
    return { ms: Date.now() - t0 }
  } catch (e) {
    const status = e.code === 'SCAN_TIMEOUT' ? 'timed_out' : 'failed'
    assertTransition('scan', 'running', status)
    await db.update('scans', { id: scan.id }, { status, error: String(e.message).slice(0, 500), riskLabel: 'inconclusive', riskScore: null, summary: `Scan ${status === 'timed_out' ? 'timed out' : 'failed'}: ${String(e.message).slice(0, 200)}. No risk conclusion can be drawn.`, completedAt: new Date() })
    return { error: e.message }
  }
}

async function collectAddressScan(scan) {
  const data = await collectAddressData(scan.chainId, scan.subject)
  if (data.fatal) return { ...data, findings: [] }
  const trusted = await trustedFor(scan.workspaceId, scan.chainId)
  const findings = runRules({ subject: scan.subject, chainId: scan.chainId, transfers: data.transfers, tokenMeta: data.tokenMeta, approvals: data.approvals, trusted })
  return { ...data, findings }
}

async function collectTransactionScan(scan) {
  const adapter = svc('chains').adapter(scan.chainId)
  const chain = chainById(scan.chainId)
  if (!adapter) return { fatal: 'RPC_NOT_CONFIGURED', coverage: [{ source: 'EVM RPC (read-only)', status: 'unavailable', note: rpcMissing(chain) }], findings: [] }
  const [t, r] = await Promise.all([adapter.getTransaction(scan.subject), adapter.getTransactionReceipt(scan.subject)])
  if (!t) return { fatal: 'TX_NOT_FOUND', coverage: [{ source: 'Transaction lookup', status: 'unavailable', note: 'Transaction not found on this network. Check the network selection.' }], findings: [] }
  const { TRANSFER_TOPIC } = await import('../../adapters/chains/evm.js')
  const txFrom = t.from.toLowerCase()
  const logs = (r?.logs || []).filter((l) => l.topics?.[0] === TRANSFER_TOPIC && l.topics.length === 3).map((l) => ({
    from: '0x' + l.topics[1].slice(26).toLowerCase(), to: '0x' + l.topics[2].slice(26).toLowerCase(), value: (l.data && l.data !== '0x' ? BigInt(l.data) : 0n).toString(), token: l.address.toLowerCase(),
  }))
  // A zero-value Transfer whose "from" is not the tx sender identifies the likely victim of a spoof.
  const spoofVictim = logs.find((l) => l.value === '0' && l.from !== txFrom)?.from
  const subject = spoofVictim || txFrom
  const focus = new Set([t.to?.toLowerCase(), txFrom, ...logs.flatMap((l) => [l.from, l.to])].filter((a) => a && a !== subject))
  const data = await collectAddressData(scan.chainId, subject, { pinnedBlock: r?.blockNumber ? BigInt(r.blockNumber) : undefined })
  data.coverage.unshift({ source: 'Transaction receipt', status: r ? 'covered' : 'partial', note: r ? `Receipt status ${r.status} in block ${r.blockNumber}; ${logs.length} Transfer log(s); analysed from the perspective of ${subject}` : 'Transaction pending — no receipt yet' })
  for (const l of logs) if (!data.transfers.some((x) => x.txHash === scan.subject.toLowerCase() && x.from === l.from && x.to === l.to)) {
    data.transfers.push({ chainId: scan.chainId, txHash: scan.subject.toLowerCase(), logIndex: 0, blockNumber: BigInt(r?.blockNumber ?? 0), kind: 'erc20', token: l.token, from: l.from, to: l.to, value: l.value, txFrom, timestamp: null })
  }
  Object.assign(data.tokenMeta, await tokenMeta(adapter, scan.chainId, logs.map((l) => l.token)))
  const trusted = await trustedFor(scan.workspaceId, scan.chainId)
  const findings = runRules({ subject, chainId: scan.chainId, transfers: data.transfers, tokenMeta: data.tokenMeta, approvals: data.approvals.filter((a) => focus.has(a.spender)), trusted, focusAddresses: focus })
  return { ...data, findings }
}

async function persistResult(scan, result) {
  const agg = result.fatal
    ? { riskScore: null, riskLabel: 'inconclusive', summary: result.fatal === 'TX_NOT_FOUND' ? 'Transaction not found on the selected network. No risk conclusion can be drawn.' : 'Scan could not run: no blockchain data provider is configured for this network. No risk conclusion can be drawn.' }
    : aggregate(result.findings, result.coverage)
  const status = result.fatal ? 'failed' : result.coverage.some((c) => c.status !== 'covered' && c.source !== 'Threat intelligence feeds') ? 'partial' : 'completed'
  assertTransition('scan', 'running', status)
  await tx(async (c) => {
    for (const cv of result.coverage) await c.insert('scan_sources', { id: newId('src'), scanId: scan.id, source: cv.source, status: cv.status, note: cv.note, fromBlock: cv.fromBlock ?? null, toBlock: cv.toBlock ?? null })
    for (const f of result.findings) {
      const fid = newId('fnd')
      await c.insert('findings', { id: fid, scanId: scan.id, ruleId: f.ruleId, ruleVersion: f.ruleVersion, category: f.category, title: f.title, severity: f.severity, riskScore: f.riskScore, confidence: f.confidence, summary: f.summary, limitations: f.limitations, recommendation: f.recommendation, subjectAddress: f.subjectAddress, relatedAddress: f.relatedAddress })
      for (const e of f.evidence) await c.insert('evidence', { id: newId('evd'), findingId: fid, kind: e.kind, label: e.label, source: e.source, value: String(e.value), txHash: e.txHash ?? null, blockNumber: e.blockNumber ?? null, logIndex: e.logIndex ?? null, observedAt: e.observedAt ?? null })
    }
    for (const a of result.approvals || []) {
      await c.insert('approval_records', { id: newId('apr'), chainId: scan.chainId, owner: scan.subjectType === 'address' ? scan.subject : (result.findings[0]?.subjectAddress || scan.subject), token: a.token, spender: a.spender, allowance: a.allowance, isUnlimited: BigInt(a.allowance) >= UNLIMITED_THRESHOLD, spenderIsContract: a.spenderIsContract, lastVerifiedBlock: a.lastBlock, status: BigInt(a.allowance) === 0n ? 'allowance_verified' : 'detected' },
        { onConflict: `ON CONFLICT (chain_id, owner, token, spender) DO UPDATE SET allowance = EXCLUDED.allowance, is_unlimited = EXCLUDED.is_unlimited, spender_is_contract = EXCLUDED.spender_is_contract, last_verified_block = EXCLUDED.last_verified_block, updated_at = now(),
          status = CASE WHEN EXCLUDED.allowance = '0' THEN approval_records.status WHEN approval_records.status = 'allowance_verified' THEN 'detected' ELSE approval_records.status END` })
    }
    // Keep a bounded copy of observed transfers for graph sync / guard activity (dedup by chain+tx+log).
    for (const t of (result.transfers || []).slice(0, 500)) {
      await c.insert('transfers', { id: newId('trf'), chainId: t.chainId, txHash: t.txHash, logIndex: t.logIndex, blockNumber: t.blockNumber, ts: t.timestamp ?? null, kind: t.kind, token: t.token, fromAddress: t.from, toAddress: t.to || '', value: t.value }, { onConflict: 'ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING' })
    }
    await c.update('scans', { id: scan.id }, { status, riskScore: agg.riskScore, riskLabel: agg.riskLabel, summary: agg.summary, pinnedBlock: result.pinnedBlock ?? null, error: result.fatal ?? null, completedAt: new Date() })
  })
  // Post-scan side effects are best-effort and never change the scan outcome.
  await svc('jobs').enqueue('graph.sync', { scanId: scan.id }).catch(() => {})
  if (scan.workspaceId) await svc('jobs').enqueue('scan.completed', { scanId: scan.id }).catch(() => {})
}

// ───────────── DTOs (shape mirrors frontend/src/lib/fixtures.ts → Scan / Finding) ─────────────
export const explorerTx = (chainId, h) => (h ? `${chainById(chainId)?.explorerUrl}/tx/${h}` : null)
export const explorerAddr = (chainId, a) => `${chainById(chainId)?.explorerUrl}/address/${a}`

export async function scanDto(scanId, { includeApprovals = true } = {}) {
  const s = await db.one('SELECT * FROM scans WHERE id = $1', [scanId])
  if (!s) return null
  const [findings, sources] = await Promise.all([
    db.q('SELECT * FROM findings WHERE scan_id = $1 ORDER BY risk_score DESC, created_at', [scanId]),
    db.q('SELECT * FROM scan_sources WHERE scan_id = $1', [scanId]),
  ])
  const evidence = findings.length ? await db.q('SELECT * FROM evidence WHERE finding_id = ANY($1)', [findings.map((f) => f.id)]) : []
  const chain = chainById(s.chainId)
  const owner = s.subjectType === 'address' ? s.subject : findings[0]?.subjectAddress
  const approvals = includeApprovals && owner ? await approvalsFor(s.chainId, owner) : []
  return {
    id: s.id, subject: s.subject, subjectType: s.subjectType, network: chain?.key, chainId: s.chainId, status: s.status,
    riskScore: s.riskScore, riskLabel: s.riskLabel, requestedAt: s.requestedAt, startedAt: s.startedAt, completedAt: s.completedAt,
    pinnedBlock: s.pinnedBlock, methodologyVersion: s.ruleVersion, summary: s.summary, error: s.error, parentScanId: s.parentScanId,
    findings: findings.map((f) => findingDto(f, evidence.filter((e) => e.findingId === f.id), s.chainId)),
    coverage: sources.map((c) => ({ source: c.source, status: c.status, note: c.note, fromBlock: c.fromBlock, toBlock: c.toBlock })),
    approvals,
    disclaimer: 'Findings are deterministic rule matches on available data. "No findings" does not prove an address is safe. riskScore is an ordering heuristic, not a calibrated probability.',
  }
}

export function findingDto(f, ev, chainId) {
  const rule = RULES[f.ruleId]
  return {
    id: f.id, ruleId: f.ruleId, ruleVersion: f.ruleVersion, category: f.category, title: f.title, severity: f.severity, confidence: f.confidence,
    riskScore: f.riskScore, method: `${rule?.name ?? f.ruleId} (${f.ruleId} · rules v${f.ruleVersion})`, detectedAt: f.createdAt, summary: f.summary,
    relatedAddress: f.relatedAddress, subjectAddress: f.subjectAddress, reviewStatus: f.reviewStatus,
    evidence: ev.map((e) => ({ kind: e.kind, label: e.label, source: e.source, value: e.value, txHash: e.txHash, blockNumber: e.blockNumber, explorerUrl: explorerTx(chainId, e.txHash) })),
    limitations: f.limitations, recommendation: f.recommendation,
  }
}

const fmtUnits = (v, d) => {
  const b = BigInt(v); if (d == null) return b.toString()
  const base = 10n ** BigInt(d); const whole = b / base; const frac = (b % base).toString().padStart(d, '0').replace(/0+$/, '').slice(0, 6)
  return whole.toLocaleString('en-US') + (frac ? '.' + frac : '')
}

/** Approval list shaped like fixtures.TOKEN_ALLOWANCES. */
export async function approvalsFor(chainId, owner) {
  const rows = await db.q(`SELECT a.*, t.symbol, t.decimals FROM approval_records a LEFT JOIN tokens t ON t.chain_id = a.chain_id AND t.address = a.token
    WHERE a.chain_id = $1 AND a.owner = $2 AND a.allowance <> '0' ORDER BY a.is_unlimited DESC, a.updated_at DESC`, [chainId, owner])
  const chain = chainById(chainId)
  return rows.map((a) => {
    const known = KNOWN_SPENDERS[a.spender]
    const risk = a.spenderIsContract === false ? 'critical' : a.isUnlimited && !known ? 'high' : a.isUnlimited ? 'low' : known ? 'info' : 'medium'
    return {
      id: a.id, token: a.symbol || `${a.token.slice(0, 8)}…`, tokenAddr: a.token, spender: a.spender,
      spenderLabel: known || (a.spenderIsContract === false ? 'Wallet address (no contract code)' : a.spenderIsContract ? 'Unrecognized contract' : 'Unknown'),
      allowance: a.isUnlimited ? 'Unlimited' : `${fmtUnits(a.allowance, a.decimals)} ${a.symbol || ''}`.trim(), allowanceRaw: a.allowance, isUnlimited: a.isUnlimited,
      network: chain?.key, chainId, risk, status: a.status, lastVerifiedBlock: a.lastVerifiedBlock, checkedAt: a.updatedAt,
      note: known ? 'Recognized contract label (identification only, not a safety guarantee)' : a.spenderIsContract === false ? 'Approvals to plain wallets are a common drainer pattern' : '',
      source: `allowance() read at block ${a.lastVerifiedBlock ?? 'unknown'}`,
    }
  })
}

export { METHODOLOGY_VERSION }
