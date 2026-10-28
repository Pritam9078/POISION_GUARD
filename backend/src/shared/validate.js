import { z } from 'zod'
import { getAddress } from 'ethers'
import { badRequest } from './errors.js'

export const ADDR_RE = /^0x[a-fA-F0-9]{40}$/
export const TX_RE = /^0x[a-fA-F0-9]{64}$/

/** Validates checksum when mixed-case is supplied; returns lowercase for storage. */
export const zAddress = z.string().trim().refine((v) => {
  if (!ADDR_RE.test(v)) return false
  if (v !== v.toLowerCase() && v !== v.toUpperCase().replace('0X', '0x')) { try { return getAddress(v) === v } catch { return false } }
  return true
}, 'Must be a valid EVM address (0x + 40 hex; checksum must be correct if mixed case)').transform((v) => v.toLowerCase())
export const zTxHash = z.string().trim().regex(TX_RE, 'Must be a 0x-prefixed 32-byte transaction hash').transform((v) => v.toLowerCase())
export const zBaseUnits = z.string().regex(/^\d{1,78}$/, 'Amount must be an integer string in base units')
export const zEmail = z.string().trim().toLowerCase().email().max(254)
export const zPassword = z.string().min(10, 'Password must be at least 10 characters').max(200)
export const zText = (max = 500) => z.string().trim().max(max)
export const zPage = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export function parse(schema, data) {
  const r = schema.safeParse(data ?? {})
  if (!r.success) {
    const f = r.error.flatten()
    const first = Object.entries(f.fieldErrors)[0]
    throw badRequest(first ? `${first[0]}: ${first[1][0]}` : (f.formErrors[0] || 'Invalid request'), f.fieldErrors)
  }
  return r.data
}

export const checksum = (a) => { try { return getAddress(a) } catch { return a } }
