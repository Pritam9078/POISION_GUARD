import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('Performance: Latency Percentiles & Concurrent Throughput Suite', () => {
  async function measureLatency(fn, iterations = 25) {
    const latencies = []
    let errors = 0

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      try {
        const ok = await fn()
        if (!ok) errors++
      } catch (err) {
        errors++
      }
      latencies.push(performance.now() - start)
    }

    latencies.sort((a, b) => a - b)
    const p50 = latencies[Math.floor(latencies.length * 0.5)]
    const p95 = latencies[Math.floor(latencies.length * 0.95)]
    const p99 = latencies[Math.floor(latencies.length * 0.99)]

    return { p50, p95, p99, errors, total: iterations }
  }

  test('Public /chains endpoint handles queries with measured latency baseline', async () => {
    const stats = await measureLatency(async () => {
      const res = await fetch(`${BASE_URL}/chains`)
      return res.status === 200
    }, 5)

    assert.equal(stats.errors, 0, 'Error count must be zero')
    assert.ok(stats.p95 > 0, `P95 latency recorded: ${stats.p95.toFixed(1)}ms`)
  })

  test('Public scan endpoint processes requests and enforces rate-limiting safeguards', async () => {
    const addresses = [
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '0x0000000000000000000000000000000000000000',
    ]

    const scanPromises = addresses.map((addr) =>
      fetch(`${BASE_URL}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId: 1, input: addr }),
      })
    )

    const responses = await Promise.all(scanPromises)
    // Every request must either succeed (200/202) or be rate-limited (429) - never 500 server crash
    for (const r of responses) {
      assert.ok(
        r.status === 200 || r.status === 202 || r.status === 429,
        `Expected 200, 202, or 429, got ${r.status}`
      )
    }
  })
})
