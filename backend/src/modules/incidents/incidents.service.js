import { newId } from '../../shared/ids.js'
import { audit } from '../audit/audit.service.js'

/** Opens a security/spend incident (workspace "security event" or platform incident). dedupeHours collapses repeats for the same sourceRef. */
export async function openIncident(c, { workspaceId = null, scope, type = 'security', category, severity, title, description, sourceRef = null, evidence = {}, dedupeHours = 0 }) {
  if (dedupeHours && sourceRef) {
    const ex = await c.one(`SELECT id FROM security_incidents WHERE source_ref = $1 AND category = $2 AND status <> 'resolved' AND opened_at > now() - ($3 || ' hours')::interval`, [sourceRef, category, String(dedupeHours)])
    if (ex) return ex
  }
  const row = await c.insert('security_incidents', { id: newId('inc'), workspaceId, scope: scope || (workspaceId ? 'workspace' : 'platform'), type, category, severity, title, description, sourceRef, evidence })
  await audit(c, { workspaceId, actor: { type: 'system', label: 'incident-detector' }, action: 'incident.open', target: { type: 'incident', id: row.id }, metadata: { category, severity } })
  return row
}
