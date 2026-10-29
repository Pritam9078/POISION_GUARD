// Must be imported FIRST by every test file (before any src import).
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/poisonguard_test'
process.env.AI_PROVIDER = 'mock'
process.env.EMBEDDING_PROVIDER = process.env.TEST_EMBEDDING_PROVIDER || 'mock'
process.env.EMAIL_PROVIDER = 'none'
process.env.DODO_WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-dodo-secret-key-0123456789ab').toString('base64')
process.env.WEBHOOK_ALLOW_PRIVATE_URLS = 'false'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.ADMIN_URL = 'http://localhost:5174'
