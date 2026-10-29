import { z } from 'zod'
import { db, tx } from '../../db/index.js'
import { parse, zAddress } from '../../shared/validate.js'
import { can } from '../../plugins/core.js'
import { newId } from '../../shared/ids.js'
import { notFound, conflict, badRequest } from '../../shared/errors.js'
import { chainById, resolveChain } from '../../shared/chains.js'
import { audit } from '../audit/audit.service.js'
import { assertWithinLimit } from '../billing/entitlements.js'
import { createScan } from '../public/public.routes.js'
import { svc } from '../../services/registry.js'

const actor = (req) => ({ type: 'user', id: req.ctx.user.id, label: req.ctx.user.name })
const ALERTS = ['suspicious_recipient', 'approval_change', 'agent_block', 'large_transfer', 'poisoning_pattern']

export async function walletDto(w) {
  const owner = await db.one('SELECT name FROM users WHERE id = $1', [w.ownerUserId])
  const by = await db.one('SELECT name FROM users WHERE id = $1', [w.createdById])
  return { id: w.id, label: w.label, address: w.address, network: chainById(w.chainId)?.key, chainId: w.chainId, walletType: w.walletType, status: w.status,
    tags: w.tags, notes: w.notes, owner: owner?.name, ownerUserId: w.ownerUserId,
    monitoring: { enabled: w.status === 'active', frequency: w.status === 'active' ? `Every ${w.frequencyMinutes} minutes` : 'Paused', frequencyMinutes: w.frequencyMinutes, alerts: w.alertPrefs, lastChecked: w.lastCheckedAt, lastScanId: w.lastScanId },
    addedBy: by?.name, addedAt: w.createdAt, updatedAt: w.updatedAt }
}

export default async function (app) {
  app.get('/wallets', { preHandler: can('wallets.view') }, async (req, reply) => {
    const q = req.query
    const rows = await db.q(`SELECT * FROM watched_wallets WHERE workspace_id = $1 AND status <> 'removed' ${q.status ? 'AND status = $2' : ''} ORDER BY created_at DESC`, q.status ? [req.ws.id, q.status] : [req.ws.id])
    reply.ok({ items: await Promise.all(rows.map(walletDto)) })
  })

  app.post('/wallets', { preHandler: can('wallets.manage') }, async (req, reply) => {
    const b = parse(z.object({
      label: z.string().trim().min(1).max(80), address: zAddress, chainId: z.union([z.number(), z.string()]).transform((v) => resolveChain(v)?.id).pipe(z.number({ error: 'Unsupported network' })),
      walletType: z.enum(['treasury', 'payroll', 'personal', 'agent_controlled', 'other']), ownerUserId: z.string().optional(),
      monitoring: z.enum(['enabled', 'paused']).default('enabled'), alertPrefs: z.array(z.enum(ALERTS)).default(['suspicious_recipient', 'approval_change']),
      frequencyMinutes: z.number().int().min(5).max(1440).default(15), tags: z.array(z.string().max(30)).max(10).default([]), notes: z.string().max(1000).default(''),
    }), req.body)
    const ownerId = b.ownerUserId || req.ctx.user.id
    const owner = await db.one(`SELECT id FROM memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`, [req.ws.id, ownerId])
    if (!owner) throw badRequest('Wallet owner must be an active workspace member')
    await assertWithinLimit(req.ws.id, 'watchedWallets')
    const w = await tx(async (c) => {
      const prev = await c.one('SELECT id, status FROM watched_wallets WHERE workspace_id = $1 AND chain_id = $2 AND address = $3', [req.ws.id, b.chainId, b.address])
      if (prev && prev.status !== 'removed') throw conflict('This wallet is already watched on that network')
      const fields = { label: b.label, walletType: b.walletType, ownerUserId: ownerId, status: b.monitoring === 'enabled' ? 'active' : 'paused', alertPrefs: b.alertPrefs, frequencyMinutes: b.frequencyMinutes, tags: b.tags, notes: b.notes }
      const row = prev ? await c.update('watched_wallets', { id: prev.id }, { ...fields, removedAt: null }) : await c.insert('watched_wallets', { id: newId('wal'), workspaceId: req.ws.id, address: b.address, chainId: b.chainId, createdById: req.ctx.user.id, ...fields })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'wallet.add', target: { type: 'wallet', id: row.id }, metadata: { address: b.address, chainId: b.chainId } })
      return row
    })
    reply.ok(await walletDto(w), {}, 201)
  })

  app.post('/wallets/validate', { preHandler: can('wallets.view') }, async (req, reply) => {
    const b = parse(z.object({ address: zAddress, chainId: z.coerce.number().int() }), req.body)
    const a = svc('chains').adapter(b.chainId)
    if (!a) return reply.ok({ address: b.address, valid: true, onChain: null, note: 'Format valid. No RPC configured for this network, so on-chain state was not checked.' })
    const code = await a.getCode(b.address).catch(() => null)
    reply.ok({ address: b.address, valid: true, isContract: code ? code !== '0x' : null, note: code === null ? 'RPC read failed' : undefined })
  })

  const getW = async (req) => {
    const w = await db.one(`SELECT * FROM watched_wallets WHERE id = $1 AND workspace_id = $2 AND status <> 'removed'`, [req.params.walletId, req.ws.id])
    if (!w) throw notFound('Wallet')
    return w
  }
  app.get('/wallets/:walletId', { preHandler: can('wallets.view') }, async (req, reply) => reply.ok(await walletDto(await getW(req))))

  app.patch('/wallets/:walletId', { preHandler: can('wallets.manage') }, async (req, reply) => {
    const b = parse(z.object({ label: z.string().trim().min(1).max(80).optional(), walletType: z.enum(['treasury', 'payroll', 'personal', 'agent_controlled', 'other']).optional(), tags: z.array(z.string().max(30)).max(10).optional(), notes: z.string().max(1000).optional() }).strict(), req.body)
    const w = await getW(req)
    const row = await tx(async (c) => { const r = await c.update('watched_wallets', { id: w.id }, b); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'wallet.update', target: { type: 'wallet', id: w.id }, metadata: { fields: Object.keys(b) } }); return r })
    reply.ok(await walletDto(row))
  })

  // Ownership change is its own audited action (requires members.manage, not just wallets.manage).
  app.post('/wallets/:walletId/owner', { preHandler: can('members.manage') }, async (req, reply) => {
    const b = parse(z.object({ ownerUserId: z.string() }), req.body)
    const w = await getW(req)
    const m = await db.one(`SELECT id FROM memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`, [req.ws.id, b.ownerUserId])
    if (!m) throw badRequest('New owner must be an active member')
    const row = await tx(async (c) => { const r = await c.update('watched_wallets', { id: w.id }, { ownerUserId: b.ownerUserId }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'wallet.owner_change', target: { type: 'wallet', id: w.id }, metadata: { from: w.ownerUserId, to: b.ownerUserId } }); return r })
    reply.ok(await walletDto(row))
  })

  app.get('/wallets/:walletId/monitoring', { preHandler: can('wallets.view') }, async (req, reply) => reply.ok((await walletDto(await getW(req))).monitoring))
  app.patch('/wallets/:walletId/monitoring', { preHandler: can('wallets.manage') }, async (req, reply) => {
    const b = parse(z.object({ enabled: z.boolean().optional(), frequencyMinutes: z.number().int().min(5).max(1440).optional(), alerts: z.array(z.enum(ALERTS)).optional() }), req.body)
    const w = await getW(req)
    const row = await tx(async (c) => {
      const r = await c.update('watched_wallets', { id: w.id }, { status: b.enabled === undefined ? undefined : b.enabled ? 'active' : 'paused', frequencyMinutes: b.frequencyMinutes, alertPrefs: b.alerts })
      await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: b.enabled === false ? 'wallet.monitoring.pause' : b.enabled ? 'wallet.monitoring.resume' : 'wallet.monitoring.update', target: { type: 'wallet', id: w.id }, metadata: b })
      return r
    })
    reply.ok((await walletDto(row)).monitoring)
  })

  // Removal stops monitoring only; history and audit records are retained.
  app.delete('/wallets/:walletId', { preHandler: can('wallets.manage') }, async (req, reply) => {
    const w = await getW(req)
    await tx(async (c) => { await c.update('watched_wallets', { id: w.id }, { status: 'removed', removedAt: new Date() }); await audit(c, { workspaceId: req.ws.id, actor: actor(req), action: 'wallet.remove', target: { type: 'wallet', id: w.id }, metadata: { address: w.address } }) })
    reply.ok({ removed: true, note: 'Monitoring stopped. Historical scans and audit records are retained.' })
  })

  app.get('/wallets/:walletId/activity', { preHandler: can('wallets.view') }, async (req, reply) => {
    const w = await getW(req)
    const [transfers, scans, intents] = await Promise.all([
      db.q(`SELECT tx_hash, log_index, block_number, ts, kind, token, from_address, to_address, value FROM transfers WHERE chain_id = $1 AND (from_address = $2 OR to_address = $2) ORDER BY block_number DESC LIMIT 100`, [w.chainId, w.address]),
      db.q(`SELECT id, status, risk_label, risk_score, requested_at FROM scans WHERE workspace_id = $1 AND chain_id = $2 AND subject = $3 ORDER BY requested_at DESC LIMIT 20`, [req.ws.id, w.chainId, w.address]),
      db.q(`SELECT id, status, amount, asset_symbol, to_address, created_at FROM spend_intents WHERE workspace_id = $1 AND wallet_id = $2 ORDER BY created_at DESC LIMIT 20`, [req.ws.id, w.id]),
    ])
    reply.ok({ transfers, scans, intents, note: 'Transfers listed are those observed by PoisonGuard scans of this wallet, not a complete chain history.' })
  })

  app.get('/wallets/:walletId/recipients', { preHandler: can('wallets.view') }, async (req, reply) => {
    const w = await getW(req)
    reply.ok({ items: await db.q(`SELECT id, label, address, status, allowed_use FROM trusted_recipients WHERE workspace_id = $1 AND chain_id = $2 ORDER BY label`, [req.ws.id, w.chainId]) })
  })

  app.post('/wallets/:walletId/scan', { preHandler: can('scans.run') }, async (req, reply) => {
    const w = await getW(req)
    await assertWithinLimit(req.ws.id, 'monthlyScans')
    const out = await createScan({ chain: chainById(w.chainId), input: w.address, workspaceId: req.ws.id, requestedBy: req.ctx.user.id })
    await db.update('watched_wallets', { id: w.id }, { lastScanId: out.scanId, lastCheckedAt: new Date() })
    reply.ok({ ...out, pollUrl: `/api/v1/workspaces/${req.ws.id}/scans/${out.scanId}` }, {}, 202)
  })
}
