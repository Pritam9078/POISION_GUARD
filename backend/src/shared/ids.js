import { randomBytes } from 'node:crypto'

const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789' // no ambiguous chars
export function randomString(len = 20) {
  const bytes = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHA[bytes[i] % ALPHA.length]
  return s
}
/** Prefixed, non-sequential identifiers: scn_xxx, wal_xxx … */
export const newId = (prefix) => `${prefix}_${randomString(18)}`
/** Short human reference numbers, e.g. FP-7KQ2M9 */
export const newRef = (prefix) => `${prefix}-${randomString(6).toUpperCase()}`
/** High-entropy secrets (agent tokens, share ids, invite tokens). */
export const secretToken = (prefix = '') => prefix + randomBytes(32).toString('base64url')
