import { db } from '../../db/index.js'
import { chainById } from '../../shared/chains.js'
import { createScan } from '../public/public.routes.js'
import { svc } from '../../services/registry.js'

/** Periodic monitoring: enqueue workspace scans for active watched wallets that are due. Skips chains without RPC. */
export async function monitorTick() {
  const due = await db.q(`SELECT w.* FROM watched_wallets w JOIN workspaces ws ON ws.id = w.workspace_id
    WHERE w.status = 'active' AND ws.status = 'active' AND (w.last_checked_at IS NULL OR w.last_checked_at < now() - (w.frequency_minutes || ' minutes')::interval)
    ORDER BY w.last_checked_at NULLS FIRST LIMIT 50`)
  let queued = 0
  for (const w of due) {
    if (!svc('chains').adapter(w.chainId)) continue
    const running = await db.one(`SELECT id FROM scans WHERE workspace_id = $1 AND subject = $2 AND chain_id = $3 AND status IN ('queued','running')`, [w.workspaceId, w.address, w.chainId])
    if (running) continue
    const s = await createScan({ chain: chainById(w.chainId), input: w.address, workspaceId: w.workspaceId, requestedBy: null })
    await db.update('watched_wallets', { id: w.id }, { lastCheckedAt: new Date(), lastScanId: s.scanId })
    queued++
  }
  return { queued }
}
