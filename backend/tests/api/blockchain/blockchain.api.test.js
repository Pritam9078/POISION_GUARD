import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Blockchain Networks & Approvals', () => {
  test('GET /chains - returns supported EVM chains', async () => {
    const res = await fetch(`${BASE_URL}/chains`)
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    const chains = data.data.items || data.data
    assert.ok(Array.isArray(chains))
    const chainIds = chains.map(c => c.id || c.chainId)
    assert.ok(chainIds.includes(1), 'Ethereum Mainnet must be supported')
    assert.ok(chainIds.includes(8453), 'Base must be supported')
  })
})

