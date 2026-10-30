import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Unit: Address Poisoning Detection Engine & Evaluation Metrics', () => {
  // Poisoning detection heuristic implementation
  function analyzeAddressRisk(candidate, history = []) {
    const cand = candidate.toLowerCase()
    let maxSimilarity = 0
    let matchedAddress = null
    let hasZeroValueSpoof = false
    let candidateIsFrequent = false

    // Check if candidate itself is a known frequent contact
    for (const item of history) {
      const addr = item.address.toLowerCase()
      if (addr === cand) {
        if (item.txCount >= 5 && item.totalVolumeEth > 1.0) {
          candidateIsFrequent = true
        }
        if (item.isZeroValueIncoming) {
          hasZeroValueSpoof = true
        }
      }
    }

    // Compare candidate against historical addresses
    for (const item of history) {
      const addr = item.address.toLowerCase()
      if (addr === cand) continue

      const candPrefix = cand.slice(2, 6)
      const addrPrefix = addr.slice(2, 6)
      const candSuffix = cand.slice(-4)
      const addrSuffix = addr.slice(-4)

      const prefixMatch = candPrefix === addrPrefix
      const suffixMatch = candSuffix === addrSuffix

      if (prefixMatch && suffixMatch) {
        maxSimilarity = 0.95
        matchedAddress = item.address
      } else if (prefixMatch || suffixMatch) {
        maxSimilarity = Math.max(maxSimilarity, 0.5)
      }
    }

    let isMalicious = false
    let riskLevel = 'LOW'

    // If address closely mimics a historical contact and engaged in zero-value incoming spoofing without being frequent
    if (maxSimilarity >= 0.9 && hasZeroValueSpoof && !candidateIsFrequent) {
      isMalicious = true
      riskLevel = 'HIGH'
    } else if (maxSimilarity >= 0.9 && !candidateIsFrequent) {
      riskLevel = 'MEDIUM'
    }

    return { isMalicious, riskLevel, similarityScore: maxSimilarity, matchedAddress }
  }

  test('Detection Engine: Successfully flags address with matching prefix/suffix and incoming zero-value transfer', () => {
    const victimHistory = [
      {
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        txCount: 10,
        totalVolumeEth: 50.0,
        isZeroValueIncoming: false,
      },
      {
        address: '0x742d99999999999999999999999999999998f44e', // Attacker lookalike
        txCount: 1,
        totalVolumeEth: 0,
        isZeroValueIncoming: true,
      },
    ]

    const candidateAttacker = '0x742d99999999999999999999999999999998f44e'
    const result = analyzeAddressRisk(candidateAttacker, victimHistory)

    assert.equal(result.isMalicious, true)
    assert.equal(result.riskLevel, 'HIGH')
    assert.ok(result.similarityScore >= 0.9)
  })

  test('Distinction: Coincidental similarity without spoofing does not label address as high risk attack', () => {
    const victimHistory = [
      {
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        txCount: 10,
        totalVolumeEth: 50.0,
        isZeroValueIncoming: false,
      },
    ]

    // Candidate has same prefix only, but no zero-value attack history
    const benignLookalike = '0x742daaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa111111'
    const result = analyzeAddressRisk(benignLookalike, victimHistory)

    assert.equal(result.isMalicious, false, 'Benign similar prefix alone must not be marked malicious')
    assert.notEqual(result.riskLevel, 'HIGH')
  })

  test('Dataset Evaluation Metrics: Compute Precision, Recall, FPR and FNR across 20 synthetic cases', () => {
    const testCases = []

    // 10 Attacks (Positive cases): mimicked address + incoming zero-value dust transfer
    for (let i = 0; i < 10; i++) {
      const targetContact = `0xaaaa${'f'.repeat(32)}bbbb`
      const attackerLookalike = `0xaaaa${i.toString().padStart(32, '0')}bbbb`
      testCases.push({
        candidate: attackerLookalike,
        history: [
          { address: targetContact, txCount: 10, totalVolumeEth: 10.0, isZeroValueIncoming: false },
          { address: attackerLookalike, txCount: 1, totalVolumeEth: 0, isZeroValueIncoming: true },
        ],
        label: true,
      })
    }

    // 10 Benign (Negative cases)
    for (let i = 0; i < 10; i++) {
      const normalSender = `0x1111${i.toString().padStart(32, '0')}2222`
      testCases.push({
        candidate: normalSender,
        history: [
          { address: `0x9999${'e'.repeat(32)}8888`, txCount: 20, totalVolumeEth: 100.0, isZeroValueIncoming: false },
          { address: normalSender, txCount: 8, totalVolumeEth: 25.0, isZeroValueIncoming: false },
        ],
        label: false,
      })
    }

    let tp = 0, fp = 0, tn = 0, fn = 0

    for (const tc of testCases) {
      const pred = analyzeAddressRisk(tc.candidate, tc.history)
      if (pred.isMalicious && tc.label) tp++
      else if (pred.isMalicious && !tc.label) fp++
      else if (!pred.isMalicious && !tc.label) tn++
      else if (!pred.isMalicious && tc.label) fn++
    }

    const precision = tp / (tp + fp)
    const recall = tp / (tp + fn)
    const fpr = fp / (fp + tn)
    const fnr = fn / (tp + fn)

    assert.equal(precision, 1.0, 'Precision must be 100% on controlled dataset')
    assert.equal(recall, 1.0, 'Recall must be 100% on controlled dataset')
    assert.equal(fpr, 0.0, 'False Positive Rate must be 0% on controlled dataset')
    assert.equal(fnr, 0.0, 'False Negative Rate must be 0% on controlled dataset')
  })
})
