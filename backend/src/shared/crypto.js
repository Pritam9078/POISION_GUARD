import { createHash, createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto'
import { promisify } from 'node:util'
import { env } from '../config/env.js'

const scrypt = promisify(_scrypt)
export const sha256 = (s) => createHash('sha256').update(s).digest('hex')
export const hmacHex = (key, s) => createHmac('sha256', key).update(s).digest('hex')

export function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b))
  return A.length === B.length && timingSafeEqual(A, B)
}

/** Token hashing for sessions/agent keys: keyed so a DB leak alone can't be replayed against a different deployment. */
export const hashToken = (token) => hmacHex(env.SESSION_SECRET, token)

// scrypt password hashing: N=2^15, r=8, p=1, 64-byte key
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
export async function hashPassword(pw) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}
export async function verifyPassword(pw, stored) {
  if (!stored?.startsWith('scrypt$')) return false
  const [, N, r, p, salt, key] = stored.split('$')
  const want = Buffer.from(key, 'base64')
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 })
  return timingSafeEqual(want, got)
}
// Constant-ish time dummy check to blunt user-enumeration timing.
export const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')

function encKey() {
  if (env.ENCRYPTION_KEY) {
    const k = Buffer.from(env.ENCRYPTION_KEY, 'base64')
    if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes base64')
    return k
  }
  return createHash('sha256').update('pg-dev-encryption:' + env.SESSION_SECRET).digest()
}
/** AES-256-GCM for secrets we must be able to use later (webhook signing secrets, MFA seeds). */
export function encrypt(plain) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', encKey(), iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${ct.toString('base64')}`
}
export function decrypt(blob) {
  const [v, iv, tag, ct] = blob.split('.')
  if (v !== 'v1') throw new Error('Unknown ciphertext version')
  const d = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8')
}

/** Deterministic JSON (sorted keys) so hashes are reproducible. */
export function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (v instanceof Date) return JSON.stringify(v.toISOString())
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}'
}

// ── TOTP (RFC 6238, SHA1, 30s, 6 digits) for staff MFA ──
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}
export function base32Decode(s) {
  let bits = 0, value = 0; const out = []
  for (const ch of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 } }
  return Buffer.from(out)
}
export const newTotpSecret = () => base32Encode(randomBytes(20))
export function totpAt(secret, t = Date.now(), step = 30) {
  const counter = Math.floor(t / 1000 / step)
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const o = h[h.length - 1] & 15
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
  return code
}
export function verifyTotp(secret, code, window = 1) {
  if (!/^\d{6}$/.test(String(code || ''))) return false
  for (let w = -window; w <= window; w++) if (safeEqual(totpAt(secret, Date.now() + w * 30000), code)) return true
  return false
}
