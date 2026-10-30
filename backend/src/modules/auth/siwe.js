import { verifyMessage, getAddress, hashMessage, Contract } from 'ethers'
import { env } from '../../config/env.js'
import { randomString } from '../../shared/ids.js'
import { svc } from '../../services/registry.js'

/** EIP-4361 (Sign-In with Ethereum) message builder. The server stores the exact message; the client signs it verbatim. */
export function buildSiweMessage({ address, chainId, purpose }) {
  const url = new URL(env.FRONTEND_URL)
  const nonce = randomString(17)
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60_000)
  const statement = purpose === 'link'
    ? 'Link this wallet to your PoisonGuard account. This signature does not authorize any transaction or token approval.'
    : 'Sign in to PoisonGuard. This signature does not authorize any transaction or token approval.'
  const message = `${url.host} wants you to sign in with your Ethereum account:\n${getAddress(address)}\n\n${statement}\n\nURI: ${url.origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`
  return { message, nonce, expiresAt }
}

const EIP1271_ABI = ['function isValidSignature(bytes32 _hash, bytes memory _signature) view returns (bytes4)']
const EIP1271_MAGIC_VALUE = '0x1626ba7e'

/**
 * Returns the lowercase recovered or verified address, or null if invalid.
 * Supports standard EOA (ECDSA) and EIP-1271 Smart Contract Wallets (e.g. Safe, ERC-4337).
 */
export async function recoverSigner(message, signature, expectedAddress = null, chainId = 1) {
  // 1. Try standard EOA recovery
  try {
    const eoa = verifyMessage(message, signature).toLowerCase()
    if (eoa) {
      if (!expectedAddress || eoa === expectedAddress.toLowerCase()) {
        return eoa
      }
    }
  } catch {
    // Malformed ECDSA signature, may be a smart contract signature (e.g. Safe multisig)
  }

  // 2. If expectedAddress is provided, verify on-chain via EIP-1271
  if (expectedAddress) {
    try {
      const adapter = svc('chains')?.adapter(Number(chainId) || 1)
      if (adapter?.provider) {
        const code = await adapter.getCode(expectedAddress)
        if (code && code !== '0x') {
          const contract = new Contract(expectedAddress, EIP1271_ABI, adapter.provider)
          const messageHash = hashMessage(message)
          const result = await contract.isValidSignature(messageHash, signature)
          if (result && result.toLowerCase() === EIP1271_MAGIC_VALUE) {
            return expectedAddress.toLowerCase()
          }
        }
      }
    } catch {
      // Contract verification failed or reverted
    }
  }

  return null
}
