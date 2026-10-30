import { env } from '../config/env.js'

/**
 * Job runner. JOB_MODE=queue → BullMQ (Redis) consumed by `npm run worker`.
 * JOB_MODE=inline → executed off the request path in this process (dev/test). drain() awaits completion (tests).
 */
export function createJobs(log) {
  const handlers = new Map()
  const pending = new Set()
  let queue = null
  const api = {
    register(name, fn) { handlers.set(name, fn) },
    handlers,
    async enqueue(name, data, opts = {}) {
      if (env.JOB_MODE === 'queue') {
        if (!queue) {
          const { Queue } = await import('bullmq')
          const { default: IORedis } = await import('ioredis')
          queue = new Queue('poisonguard', { connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }) })
        }
        return queue.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000, ...opts })
      }
      const fn = handlers.get(name)
      if (!fn) { log.warn({ name }, 'no handler for job'); return null }
      const p = new Promise((r) => setImmediate(r)).then(() => fn(data)).catch((e) => log.error({ err: e, name }, 'inline job failed')).finally(() => pending.delete(p))
      pending.add(p)
      return { id: 'inline' }
    },
    async drain() { while (pending.size) await Promise.all([...pending]) },
    async queueStats() {
      if (!queue) return { mode: env.JOB_MODE, pending: pending.size }
      return { mode: 'queue', ...(await queue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed')) }
    },
  }
  return api
}
