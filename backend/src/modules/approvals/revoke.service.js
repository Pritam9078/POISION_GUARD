import { db } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { ERC20 } from '../../adapters/chains/evm.js'
import { chainById } from '../../shared/chains.js'
import { svc } from '../../services/registry.js'
import { unavailable, badRequest, conflict } from '../../shared/errors.js'
import { UNLIMITED_THRESHOLD } from '../scanner/rules.js'

const adapterOr503 = (chainId) => {
  const a = svc('chains').adapter(chainId)
  if (!a) throw unavailable(`No RPC configured for chain ${chainId}`, 'RPC_NOT_CONFIGURED')
  return a
}

/** Builds the unsigned approve(spender, 0) transaction. The user signs it in their own wallet; we never sign. */
export async function previewRevoke({ chainId, owner, token, spender }) {
  const chain = chainById(chainId)
  if (!chain.capabilities.includes('revoke')) throw badRequest(`Revocation is not supported on ${chain.name} yet`)
  const a = adapterOr503(chainId)
  const [current, head] = await Promise.all([a.getAllowance(token, owner, spender), a.getBlockNumber()])
  const data = ERC20.encodeFunctionData('approve', [spender, 0n])
  let gas = null
  try { gas = (await a.estimateGas({ from: owner, to: token, data })).toString() } catch { /* some tokens revert estimation for non-holders */ }
  await db.insert('approval_records', { id: newId('apr'), chainId, owner, token, spender, allowance: current.toString(), isUnlimited: current >= UNLIMITED_THRESHOLD, lastVerifiedBlock: head, status: 'revoke_prepared' },
    { onConflict: `ON CONFLICT (chain_id, owner, token, spender) DO UPDATE SET allowance = EXCLUDED.allowance, is_unlimited = EXCLUDED.is_unlimited, last_verified_block = EXCLUDED.last_verified_block, status = 'revoke_prepared', updated_at = now()` })
  return {
    status: 'revoke_prepared', currentAllowance: current.toString(), alreadyZero: current === 0n, checkedAtBlock: head,
    transaction: { chainId, from: owner, to: token, data, value: '0x0' },
    method: 'approve(address,uint256)', args: { spender, amount: '0' }, estimatedGas: gas,
    warnings: [
      'This revokes the allowance only. It does not recover tokens that were already transferred.',
      'Confirm that the "to" address in your wallet prompt equals the token contract shown here.',
      'PoisonGuard never asks for your seed phrase or private key.',
    ],
  }
}

/**
 * Verify a submitted revoke: receipt must exist, succeed, target the token, come from the owner, encode approve(spender, 0);
 * then the allowance is re-read from chain. Only a re-read of 0 yields allowance_verified.
 */
export async function verifyRevoke({ chainId, owner, token, spender, txHash }) {
  const a = adapterOr503(chainId)
  const rec = await db.one('SELECT * FROM approval_records WHERE chain_id = $1 AND owner = $2 AND token = $3 AND spender = $4', [chainId, owner, token, spender])
  const set = (patch) => db.update('approval_records', { chainId, owner, token, spender }, patch)
  const t = await a.getTransaction(txHash).catch(() => null)
  if (!t) { if (rec) await set({ revokeTxHash: txHash, status: 'submitted' }); return { status: 'verification_pending', txHash, message: 'Transaction not yet visible on chain. Retry shortly.' } }
  if (t.from.toLowerCase() !== owner) throw conflict('Transaction was not sent by the wallet owner', 'TX_MISMATCH')
  if (t.to?.toLowerCase() !== token) throw conflict('Transaction does not target the token contract', 'TX_MISMATCH')
  let decoded
  try { decoded = ERC20.decodeFunctionData('approve', t.data) } catch { throw conflict('Transaction is not an ERC-20 approve() call', 'TX_MISMATCH') }
  if (decoded[0].toLowerCase() !== spender || BigInt(decoded[1]) !== 0n) throw conflict('approve() arguments do not match approve(spender, 0)', 'TX_MISMATCH')
  const r = await a.getTransactionReceipt(txHash).catch(() => null)
  if (!r) { if (rec) await set({ revokeTxHash: txHash, status: 'submitted' }); return { status: 'submitted', txHash, message: 'Submitted — waiting for confirmation.' } }
  if (r.status !== 1) { if (rec) await set({ revokeTxHash: txHash, status: 'reverted' }); return { status: 'reverted', txHash, blockNumber: r.blockNumber, message: 'Transaction reverted; the allowance is unchanged.' } }
  const head = await a.getBlockNumber()
  const confs = head - r.blockNumber + 1
  const needed = chainById(chainId).confirmations
  if (confs < needed) { if (rec) await set({ revokeTxHash: txHash, status: 'submitted' }); return { status: 'confirmed_pending_finality', txHash, confirmations: confs, required: needed, message: `Mined; waiting for ${needed} confirmations before re-reading the allowance.` } }
  const after = await a.getAllowance(token, owner, spender, head)
  const verified = after === 0n
  if (rec) await set({ revokeTxHash: txHash, allowance: after.toString(), isUnlimited: after >= UNLIMITED_THRESHOLD, lastVerifiedBlock: head, status: verified ? 'allowance_verified' : 'verification_failed' })
  return {
    status: verified ? 'allowance_verified' : 'verification_failed', txHash, blockNumber: r.blockNumber, confirmations: confs,
    allowanceAfter: after.toString(), checkedAtBlock: head,
    message: verified ? `Revoked: allowance re-read as 0 at block ${head}.` : `Transaction succeeded but allowance re-read as ${after} at block ${head}. A new approval may have been granted.`,
  }
}
