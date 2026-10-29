import { verifyMessage, getAddress } from 'ethers'
import { env } from '../../config/env.js'
import { randomString } from '../../shared/ids.js'

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

/** Returns the lowercase recovered address, or null if the signature is malformed. EOA signatures only (EIP-1271 not yet supported). */
export function recoverSigner(message, signature) {
  try { return verifyMessage(message, signature).toLowerCase() } catch { return null }
}
