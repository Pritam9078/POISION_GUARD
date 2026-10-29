import { db } from '../../db/index.js'
import { newId } from '../../shared/ids.js'
import { svc } from '../../services/registry.js'

/** In-app notification + fan-out to subscribed webhooks. Payloads never contain secrets or personal data beyond ids. */
export async function notify(c, workspaceId, { type, title, body, refType = null, refId = null, userId = null }) {
  const n = await c.insert('notifications', { id: newId('ntf'), workspaceId, userId, type, title, body, refType, refId })
  await emitEvent(c, workspaceId, type, { notificationId: n.id, type, title, refType, refId, at: n.createdAt })
  return n
}

export async function emitEvent(c, workspaceId, eventType, data) {
  const eps = await c.q(`SELECT id FROM webhook_endpoints WHERE workspace_id = $1 AND status = 'active' AND ($2 = ANY(events) OR '*' = ANY(events))`, [workspaceId, eventType])
  if (!eps.length) return
  const eventId = newId('evt')
  for (const e of eps) await c.insert('webhook_deliveries', { id: newId('whd'), endpointId: e.id, eventId, eventType, payload: { id: eventId, type: eventType, workspaceId, createdAt: new Date().toISOString(), data } }, { onConflict: 'ON CONFLICT (endpoint_id, event_id) DO NOTHING' })
  svc('jobs').enqueue('webhook.deliver', {}).catch(() => {})
}

/** After a workspace scan: notify on findings and open security events for watched wallets. */
export async function onScanCompleted({ scanId }) {
  const s = await db.one('SELECT * FROM scans WHERE id = $1', [scanId])
  if (!s?.workspaceId) return
  const f = await db.q(`SELECT id, severity, rule_id, title FROM findings WHERE scan_id = $1 AND severity IN ('critical','high')`, [scanId])
  const { tx } = await import('../../db/index.js')
  const { openIncident } = await import('../incidents/incidents.service.js')
  await tx(async (c) => {
    await notify(c, s.workspaceId, { type: 'scan_completed', title: `Scan ${s.status}`, body: `${s.subject}: ${s.summary}`, refType: 'scan', refId: s.id })
    const watched = await c.one(`SELECT id, label FROM watched_wallets WHERE workspace_id = $1 AND chain_id = $2 AND address = $3 AND status = 'active'`, [s.workspaceId, s.chainId, s.subject])
    if (watched && f.length) {
      for (const x of f) await openIncident(c, { workspaceId: s.workspaceId, type: 'security', category: x.ruleId.startsWith('PG-APPROVAL') ? 'risky_approval' : 'suspicious_recipient', severity: x.severity, title: `${x.title} on watched wallet "${watched.label}"`, description: `Finding ${x.id} (${x.ruleId}) in scan ${s.id}.`, sourceRef: x.id, evidence: { scanId: s.id, findingId: x.id } })
      await notify(c, s.workspaceId, { type: 'risk_finding', title: 'High-severity finding on a watched wallet', body: `${f.length} high/critical finding(s) on "${watched.label}"`, refType: 'scan', refId: s.id })
    }
  })
}
