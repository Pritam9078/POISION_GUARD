import { AppError } from '../../shared/errors.js'
import { verifyStandardWebhook } from '../../adapters/payments/dodo.js'
import { processDodoEvent } from './billing.service.js'
import { db } from '../../db/index.js'
import { newId } from '../../shared/ids.js'

export default async function (app) {
  app.post('/dodo', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req, reply) => {
    const h = req.headers
    const v = verifyStandardWebhook({ id: h['webhook-id'], timestamp: h['webhook-timestamp'], signature: h['webhook-signature'], rawBody: req.rawBody })
    if (!v.ok) {
      await db.insert('provider_health_events', { id: newId('phe'), integrationKey: 'payments:dodo', status: 'webhook_rejected', error: v.reason }).catch(() => {})
      throw new AppError(401, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook signature verification failed')
    }
    const r = await processDodoEvent(h['webhook-id'], req.body)
    return reply.ok({ received: true, ...r })
  })
}
