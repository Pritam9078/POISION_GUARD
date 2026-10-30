import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import IORedis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { env, isTest } from './config/env.js'
import core, { allowedOrigins } from './plugins/core.js'
import { wireServices } from './services/wire.js'
import { AppError } from './shared/errors.js'

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? (isTest ? false : { level: env.LOG_LEVEL, redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]', '*.password', '*.signature'] }),
    genReqId: (req) => (typeof req.headers['x-request-id'] === 'string' && /^[\w-]{8,64}$/.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : randomUUID()),
    bodyLimit: 256 * 1024,
    trustProxy: env.TRUST_PROXY,
  })
  wireServices(app.log)

  // Raw body for webhook signature verification (must hash the exact bytes received).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body
    if (!body) return done(null, undefined)
    try { done(null, JSON.parse(body)) } catch { done(new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON')) }
  })

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } })
  await app.register(cors, { origin: (o, cb) => cb(null, !o || allowedOrigins().includes(o)), credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] })
  await app.register(cookie, { secret: env.SESSION_SECRET })

  let rateLimitRedis = null
  if (env.REDIS_URL && !isTest) {
    try {
      rateLimitRedis = new IORedis(env.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1, enableOfflineQueue: false })
      rateLimitRedis.on('error', (err) => {
        app.log.warn({ err: err.message }, 'Redis rate-limit client warning; fallback to in-memory store')
      })
    } catch (err) {
      app.log.warn({ err: err.message }, 'Failed to initialize Redis for rate-limiting')
    }
  }

  await app.register(rateLimit, {
    global: true,
    max: isTest ? 100000 : 300,
    timeWindow: '1 minute',
    ...(rateLimitRedis ? { redis: rateLimitRedis } : {}),
    ...(isTest ? { allowList: () => !process.env.TEST_RATE_LIMIT } : {})
  })
  await app.register(core)
  await app.register(swagger, { openapi: { info: { title: 'PoisonGuard API', version: '1.0.0', description: 'Public scanner, Guard workspace, agent and admin APIs. Envelope: { success, data | error, meta.requestId }.' }, servers: [{ url: env.APP_URL }] } })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })

  const p = '/api/v1'
  await app.register((await import('./modules/public/public.routes.js')).default, { prefix: p })
  await app.register((await import('./modules/auth/auth.routes.js')).default, { prefix: `${p}/auth` })
  await app.register((await import('./routes/workspace.routes.js')).default, { prefix: `${p}/workspaces` })
  await app.register((await import('./modules/agents/agent-api.routes.js')).default, { prefix: `${p}/agent` })
  await app.register((await import('./modules/billing/webhook.routes.js')).default, { prefix: `${p}/webhooks` })
  await app.register((await import('./routes/admin.routes.js')).default, { prefix: `${p}/admin` })
  return app
}
