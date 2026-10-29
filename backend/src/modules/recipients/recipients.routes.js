import { z } from 'zod'
import { db, tx } from '../../db/index.js'
import { parse, zAddress, zTxHash } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { newId } from '../../shared/ids.js'
import { notFound, conflict, forbidden } from '../../shared/errors.js'
import { chainById, resolveChain } from '../../shared/chains.js'
import { audit } from '../audit/audit.service.js'
import { checkRecipient } from './check.service.js'
import { similarity } from '../scanner/rules.js'

const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })
const zChainId = z.union([z.number(), z.string()]).transform((v) => resolveChain(v)?.id).pipe(z.number({ error: 'Unsupported network' }))
const SNAP = ['label', 'address', 'chainId', 'tokenRestrictions', 'allowedUse', 'verificationMethod', 'verificationEvidence', 'status', 'effectiveAt', 'expiresAt', 'notes', 'reviewerUserId']
const snapshot = (r) => Object.fromEntries(SNAP.map((k) => [k, r[k]]))

async function dto(r) {
  const [upd, rev] = await Promise.all([db.one('SELECT name FROM users WHERE id = $1', [r.updatedById]), r.reviewerUserId ? db.one('SELECT name FROM users WHERE id = $1', [r.reviewerUserId]) : null])
  return { id: r.id, label: r.label, address: r.address, network: chainById(r.chainId)?.key, chainId: r.chainId, description: r.notes, notes: r.notes,
    tokenRestrictions: r.tokenRestrictions, allowedUse: r.allowedUse, verificationMethod: r.verificationMethod, verificationEvidence: r.verificationEvidence,
    reviewer: rev?.name ?? null, acknowledgedRisk: r.status === 'active', status: r.status, effectiveAt: r.effectiveAt, expiresAt: r.expiresAt, version: r.version,
    updatedBy: upd?.name, updatedAt: r.updatedAt, createdAt: r.createdAt,
    note: 'Trusted status never overrides hard policy rules or current poisoning evidence.' }
}

export default async function (app) {
  app.get('/recipients', { preHandler: can('recipients.view') }, async (req, reply) => {
    const st = req.query.status
    const rows = await db.q(`SELECT * FROM trusted_recipients WHERE workspace_id = $1 ${st ? 'AND status = $2' : ''} ORDER BY updated_at DESC`, st ? [req.ws.id, st] : [req.ws.id])
    reply.ok({ items: await Promise.all(rows.map(dto)) })
  })

  app.post('/recipients/check', { preHandler: can('recipients.view') }, async (req, reply) => {
    const b = parse(z.object({ chainId: zChainId.default(1), address: zAddress, senderAddress: zAddress.optional(), expectedLabel: z.string().max(120).optional(), contextTxHash: zTxHash.optional() }), req.body)
    reply.ok(await checkRecipient({ ...b, workspaceId: req.ws.id }))
  })

  app.post('/recipients', { preHandler: can('recipients.manage') }, async (req, reply) => {
    const b = parse(z.object({
      label: z.string().trim().min(1).max(80), address: zAddress, chainId: zChainId, tokenRestrictions: z.array(zAddress.or(z.literal('native'))).default([]),
      allowedUse: z.enum(['payroll', 'vendor', 'treasury', 'other']), verificationMethod: z.enum(['independent_confirmation', 'multisig_approval', 'other']),
      verificationEvidence: z.string().trim().min(5, 'Describe how the address was independently verified').max(2000),
      effectiveAt: z.string().datetime().optional(), expiresAt: z.string().datetime().optional(), notes: z.string().max(2000).default(''),
    }), req.body)
    const others = await db.q(`SELECT label, address FROM trusted_recipients WHERE workspace_id = $1 AND chain_id = $2 AND status <> 'inactive'`, [req.ws.id, b.chainId])
    const look = others.find((o) => o.address !== b.address && similarity(o.address, b.address).strength)
    const r = await tx(async (c) => {
      const ex = await c.one('SELECT id FROM trusted_recipients WHERE workspace_id = $1 AND chain_id = $2 AND address = $3', [req.ws.id, b.chainId, b.address])
      if (ex) throw conflict('This address is already in the trusted list for that network')
      const row = await c.insert('trusted_recipients', { id: newId('rcp'), workspaceId: req.ws.id, ...b, effectiveAt: b.effectiveAt ? new Date(b.effectiveAt) : new Date(), expiresAt: b.expiresAt ? new Date(b.expiresAt) : null, status: 'pending_verification', createdById: req.ctx.user.id, updatedById: req.ctx.user.id })
      await c.insert('trusted_recipient_versions', { id: newId('rcv'), recipientId: row.id, version: 1, snapshot: snapshot(row), change: 'Created (pending verification)', changedById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'recipient.create', target: { type: 'recipient', id: row.id }, metadata: { address: b.address, chainId: b.chainId, lookalikeWarning: look?.address } })
      return row
    })
    reply.ok({ ...(await dto(r)), warnings: look ? [`This address resembles existing trusted recipient "${look.label}" (${look.address}). Verify carefully — this is a common poisoning pattern.`] : [] }, {}, 201)
  })

  const getR = async (req, lock = false) => {
    const r = await db.one(`SELECT * FROM trusted_recipients WHERE id = $1 AND workspace_id = $2`, [req.params.recipientId, req.ws.id])
    if (!r) throw notFound('Recipient')
    return r
  }
  app.get('/recipients/:recipientId', { preHandler: can('recipients.view') }, async (req, reply) => reply.ok(await dto(await getR(req))))

  // Material edits create a new version and return the recipient to pending verification. Address/chain are immutable.
  app.patch('/recipients/:recipientId', { preHandler: can('recipients.manage') }, async (req, reply) => {
    const b = parse(z.object({ label: z.string().trim().min(1).max(80).optional(), tokenRestrictions: z.array(zAddress.or(z.literal('native'))).optional(), allowedUse: z.enum(['payroll', 'vendor', 'treasury', 'other']).optional(), expiresAt: z.string().datetime().nullable().optional(), notes: z.string().max(2000).optional(), change: z.string().trim().min(3).max(300) }).strict(), req.body)
    const cur = await getR(req)
    const material = ['tokenRestrictions', 'allowedUse', 'expiresAt'].some((k) => b[k] !== undefined) || (b.label !== undefined && b.label !== cur.label)
    const r = await tx(async (c) => {
      const row = await c.update('trusted_recipients', { id: cur.id }, { label: b.label, tokenRestrictions: b.tokenRestrictions, allowedUse: b.allowedUse, expiresAt: b.expiresAt === undefined ? undefined : b.expiresAt && new Date(b.expiresAt), notes: b.notes, version: cur.version + 1, updatedById: req.ctx.user.id, status: material && cur.status === 'active' ? 'pending_verification' : undefined, reviewerUserId: material ? null : undefined })
      await c.insert('trusted_recipient_versions', { id: newId('rcv'), recipientId: cur.id, version: row.version, snapshot: snapshot(row), change: b.change, changedById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'recipient.update', target: { type: 'recipient', id: cur.id }, metadata: { version: row.version, material } })
      return row
    })
    reply.ok(await dto(r))
  })

  // Verification needs a different person than the creator/last editor (four-eyes).
  app.post('/recipients/:recipientId/verify', { preHandler: can('recipients.verify') }, async (req, reply) => {
    const b = parse(z.object({ evidence: z.string().trim().min(5).max(2000) }), req.body)
    const cur = await getR(req)
    if (cur.status !== 'pending_verification') throw conflict(`Recipient is ${cur.status}`)
    if (cur.updatedById === req.ctx.user.id || cur.createdById === req.ctx.user.id) throw forbidden('A different member must verify a recipient they did not add or edit')
    const r = await tx(async (c) => {
      const row = await c.update('trusted_recipients', { id: cur.id }, { status: 'active', reviewerUserId: req.ctx.user.id, verificationEvidence: `${cur.verificationEvidence}\n[Reviewer] ${b.evidence}`, version: cur.version + 1, updatedById: cur.updatedById })
      await c.insert('trusted_recipient_versions', { id: newId('rcv'), recipientId: cur.id, version: row.version, snapshot: snapshot(row), change: 'Verified and activated', changedById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'recipient.verify', target: { type: 'recipient', id: cur.id } })
      return row
    })
    reply.ok(await dto(r))
  })

  app.post('/recipients/:recipientId/deactivate', { preHandler: can('recipients.manage') }, async (req, reply) => {
    const b = parse(z.object({ reason: z.string().trim().min(3).max(300) }), req.body)
    const cur = await getR(req)
    const r = await tx(async (c) => {
      const row = await c.update('trusted_recipients', { id: cur.id }, { status: 'inactive', version: cur.version + 1, updatedById: req.ctx.user.id })
      await c.insert('trusted_recipient_versions', { id: newId('rcv'), recipientId: cur.id, version: row.version, snapshot: snapshot(row), change: `Deactivated: ${b.reason}`, changedById: req.ctx.user.id })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'recipient.deactivate', target: { type: 'recipient', id: cur.id }, metadata: { reason: b.reason } })
      return row
    })
    reply.ok(await dto(r))
  })

  app.get('/recipients/:recipientId/history', { preHandler: can('recipients.view') }, async (req, reply) => {
    await getR(req)
    reply.ok({ items: await db.q(`SELECT v.version, v.change, v.snapshot, v.created_at AS at, u.name AS by FROM trusted_recipient_versions v LEFT JOIN users u ON u.id = v.changed_by_id WHERE v.recipient_id = $1 ORDER BY v.version DESC`, [req.params.recipientId]) })
  })
}
