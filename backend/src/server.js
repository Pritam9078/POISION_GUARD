import dns from 'node:dns'
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
  const origLookup = dns.lookup
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    dns.resolve4(hostname, (err, addrs) => {
      if (!err && addrs?.length) {
        if (options?.all) return callback(null, addrs.map((a) => ({ address: a, family: 4 })))
        return callback(null, addrs[0], 4)
      }
      origLookup(hostname, options, callback)
    })
  }
} catch {}

import { buildApp } from './app.js'
import { env } from './config/env.js'
import { runMigrations } from './db/migrate.js'
import { seedReference } from './db/seed-reference.js'
import { svc } from './services/registry.js'
import { pool } from './db/index.js'

const app = await buildApp()
await runMigrations((m) => app.log.info(m))
await seedReference()
await app.listen({ port: env.PORT, host: env.HOST })

// Process safety handlers
process.on('unhandledRejection', (reason) => {
  app.log.warn({ reason: reason?.message || reason }, 'Unhandled Promise Rejection')
})
process.on('uncaughtException', (err) => {
  app.log.error({ err: err?.message || err }, 'Uncaught Exception')
})

// Inline mode runs periodic jobs in-process; queue mode leaves them to the worker.
const timers = []
if (env.JOB_MODE === 'inline') {
  const every = (ms, name) => timers.push(setInterval(() => svc('jobs').enqueue(name, {}).catch(() => {}), ms))
  every(60_000, 'monitor.tick'); every(30_000, 'webhook.deliver'); every(5 * 60_000, 'integrations.health'); every(60 * 60_000, 'audit.checkpoint'); every(6 * 3600_000, 'maintenance.retention')
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { timers.forEach(clearInterval); await app.close(); await pool.end(); process.exit(0) })
