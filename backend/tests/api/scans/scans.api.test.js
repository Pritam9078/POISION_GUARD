import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { TEST_ADDRESSES } from '../../fixtures/test-addresses.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Scanner & Poisoning Detection Engine', () => {
  test('POST /scans - rejects malformed address', async () => {
    const res = await fetch(`${BASE_URL}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: 1,
        input: TEST_ADDRESSES.invalidHex,
      }),
    })
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.equal(data.success, false)
  })

  test('POST /scans - accepts valid Ethereum address and starts analysis', async () => {
    const res = await fetch(`${BASE_URL}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: 1,
        input: TEST_ADDRESSES.vitalik,
      }),
    })
    assert.ok(res.status === 202 || res.status === 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.scanId)
  })

  test('POST /scans - handles lookalike / suspected address without 500 error', async () => {
    const res = await fetch(`${BASE_URL}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: 1,
        input: TEST_ADDRESSES.lookalikePoisoned,
      }),
    })
    assert.ok(res.status === 202 || res.status === 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.data.scanId)
  })
})

