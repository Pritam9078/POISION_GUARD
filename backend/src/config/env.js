import 'dotenv/config'
import { z } from 'zod'

const bool = (d) => z.enum(['true', 'false', '1', '0']).default(d ? 'true' : 'false').transform((v) => v === 'true' || v === '1')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().default('http://localhost:4000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ADMIN_URL: z.string().default('http://localhost:5174'),
  CORS_ORIGINS: z.string().optional(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  // inline = run jobs in-process (dev/test). queue = BullMQ + separate worker process.
  JOB_MODE: z.enum(['inline', 'queue']).default('inline'),

  SESSION_SECRET: z.string().min(32).default('dev-only-session-secret-change-me-please-32+'),
  ENCRYPTION_KEY: z.string().optional(), // 32-byte base64; required in production
  COOKIE_SECURE: bool(false),
  SESSION_TTL_HOURS: z.coerce.number().default(24 * 7),
  STAFF_SESSION_TTL_HOURS: z.coerce.number().default(8),

  ETHEREUM_RPC_URL: z.string().optional(),
  BASE_RPC_URL: z.string().optional(),
  ARBITRUM_RPC_URL: z.string().optional(),
  OPTIMISM_RPC_URL: z.string().optional(),
  POLYGON_RPC_URL: z.string().optional(),
  BSC_RPC_URL: z.string().optional(),
  SEPOLIA_RPC_URL: z.string().optional(),
  // Max block span scanned via eth_getLogs when no indexer is configured.
  SCAN_LOG_BLOCK_RANGE: z.coerce.number().default(50000),
  SCAN_LOG_CHUNK: z.coerce.number().default(10000),
  SCAN_TIMEOUT_MS: z.coerce.number().default(60000),

  // Etherscan V2 multichain API (optional indexer for full history)
  ETHERSCAN_API_KEY: z.string().optional(),
  ETHERSCAN_API_URL: z.string().default('https://api.etherscan.io/v2/api'),

  TIGERGRAPH_HOST: z.string().optional(),
  TIGERGRAPH_GRAPH_NAME: z.string().default('PoisonGuard'),
  TIGERGRAPH_SECRET: z.string().optional(),
  TIGERGRAPH_TOKEN: z.string().optional(),

  AI_PROVIDER: z.enum(['none', 'mock', 'anthropic', 'openai']).default('none'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['none', 'mock', 'local', 'openai']).default('local'),
  EMBEDDING_LOCAL_MODEL: z.string().default('Xenova/all-MiniLM-L6-v2'),
  EMBEDDING_LOCAL_DTYPE: z.string().default('q8'),
  EMBEDDING_MODEL_PATH: z.string().optional(), // folder containing <org>/<model>/ for offline installs
  EMBEDDING_CACHE_DIR: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.25),

  DODO_API_KEY: z.string().optional(),
  DODO_WEBHOOK_SECRET: z.string().optional(),
  DODO_ENVIRONMENT: z.enum(['test_mode', 'live_mode']).default('test_mode'),
  DODO_RETURN_URL: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['none', 'console', 'resend']).default('console'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('PoisonGuard <no-reply@poisonguard.local>'),

  PROOF_REGISTRY_CHAIN_ID: z.coerce.number().optional(),
  PROOF_REGISTRY_ADDRESS: z.string().optional(),
  PROOF_ANCHOR_PRIVATE_KEY: z.string().optional(), // platform-owned anchoring key, never a user key

  WEBHOOK_ALLOW_PRIVATE_URLS: bool(false),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: bool(false),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}
export const env = parsed.data

if (env.NODE_ENV === 'production') {
  const problems = []
  if (!env.ENCRYPTION_KEY) problems.push('ENCRYPTION_KEY is required in production')
  if (env.SESSION_SECRET.startsWith('dev-only')) problems.push('SESSION_SECRET must be set in production')
  if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production')
  if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
}

export const isTest = env.NODE_ENV === 'test'
export const isProd = env.NODE_ENV === 'production'
