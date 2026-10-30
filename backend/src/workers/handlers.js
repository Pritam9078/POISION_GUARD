import { executeScan } from '../modules/scanner/scan.service.js'

/** All background job handlers. Each must be idempotent: re-delivery must not duplicate effects. */
export function registerJobHandlers(jobs, log) {
  jobs.register('scan.run', ({ scanId }) => executeScan(scanId))
  const later = (path, fn) => async (data) => (await import(path))[fn](data)
  jobs.register('scan.completed', later('../modules/notifications/notify.service.js', 'onScanCompleted'))
  jobs.register('graph.sync', later('../modules/graph/graph.service.js', 'syncScan'))
  jobs.register('webhook.deliver', later('../modules/notifications/webhooks.service.js', 'deliverPending'))
  jobs.register('intent.reconcile', later('../modules/intents/execution.service.js', 'reconcileAttempt'))
  jobs.register('monitor.tick', later('../modules/wallets/monitor.service.js', 'monitorTick'))
  jobs.register('rag.ingest', later('../modules/knowledge/knowledge.service.js', 'ingestDocument'))
  jobs.register('audit.checkpoint', later('../modules/proofs/proofs.service.js', 'checkpointAll'))
  jobs.register('integrations.health', later('../modules/admin/health.service.js', 'checkIntegrations'))
  jobs.register('maintenance.retention', later('../modules/admin/health.service.js', 'retentionSweep'))
  log.debug?.('job handlers registered')
}
