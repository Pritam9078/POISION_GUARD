import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api/v1'

describe('API: Findings & False Positive Reporting', () => {
  test('POST /report-phishing - submits suspicious domain/address report', async () => {
    const res = await fetch(`${BASE_URL}/report-phishing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://poison-phishing-test-domain.example',
        notes: 'Automated test report for phishing submission',
      }),
    })
    // 200 or 201 or 400 validation
    assert.ok(res.status < 500, `Unexpected server error ${res.status}`)
  })
})

