/** Queue worker (JOB_MODE=queue). Runs job handlers and repeatable maintenance jobs. */
import { Worker, Queue } from 'bullmq'
import IORedis from 'ioredis'
import pino from 'pino'
import { env } from '../config/env.js'
import { wireServices } from '../services/wire.js'
import { svc } from '../services/registry.js'
import { runMigrations } from '../db/migrate.js'
import { seedReference } from '../db/seed-reference.js'

const log = pino({ level: env.LOG_LEVEL })
if (env.JOB_MODE !== 'queue' || !env.REDIS_URL) { log.error('Worker requires JOB_MODE=queue and REDIS_URL'); process.exit(1) }
wireServices(log)
await runMigrations((m) => log.info(m)); await seedReference()
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
const handlers = svc('jobs').handlers
const worker = new Worker('poisonguard', async (job) => {
  const fn = handlers.get(job.name)
  if (!fn) throw new Error(`No handler for ${job.name}`)
  return fn(job.data)
}, { connection, concurrency: 8, limiter: { max: 50, duration: 1000 } })
worker.on('failed', (job, err) => log.error({ job: job?.name, id: job?.id, err: err.message }, 'job failed'))
const q = new Queue('poisonguard', { connection })
for (const [name, every] of [['monitor.tick', 60_000], ['webhook.deliver', 30_000], ['integrations.health', 300_000], ['audit.checkpoint', 3_600_000], ['maintenance.retention', 21_600_000]]) {
  await q.upsertJobScheduler(name, { every }, { name, data: {} })
}
log.info('PoisonGuard worker started')
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await worker.close(); process.exit(0) })
