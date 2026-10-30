import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import Redis from 'ioredis'

describe('Integration: Redis Cache & Queues', () => {
  const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379'
  let redis

  test('connects to Redis and performs PING / SET / GET', async () => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    try {
      await redis.connect()
      const pong = await redis.ping()
      assert.equal(pong, 'PONG')

      const testKey = 'poisonguard:test:ping'
      await redis.set(testKey, 'ok', 'EX', 10)
      const val = await redis.get(testKey)
      assert.equal(val, 'ok')
      await redis.del(testKey)
    } finally {
      await redis.quit()
    }
  })
})
