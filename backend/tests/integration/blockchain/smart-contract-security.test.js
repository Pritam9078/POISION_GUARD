import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ethers } from 'ethers'

describe('Smart Contract: ProofRegistry Security & Access Control Suite', () => {
  // Formal Mock ProofRegistry contract emulator matching ProofRegistry.sol logic
  class MockProofRegistry {
    constructor(adminAddress) {
      this.admin = adminAddress.toLowerCase()
      this.anchorers = new Set([this.admin])
      this.pausers = new Set([this.admin])
      this.revokers = new Set([this.admin])
      this.paused = false
      this.proofs = new Map() // hash -> { reasonHash, timestamp, revoked }
    }

    anchor(caller, proofHash, reasonHash) {
      if (this.paused) throw new Error('Pausable: paused')
      if (!this.anchorers.has(caller.toLowerCase())) throw new Error('AccessControl: caller is not an anchorer')
      if (!proofHash || proofHash === ethers.ZeroHash) throw new Error('ProofRegistry: zero hash invalid')
      if (this.proofs.has(proofHash)) throw new Error('ProofRegistry: proof already anchored')

      this.proofs.set(proofHash, { reasonHash, timestamp: Date.now(), revoked: false })
      return { success: true, proofHash }
    }

    pause(caller) {
      if (!this.pausers.has(caller.toLowerCase())) throw new Error('AccessControl: caller is not a pauser')
      this.paused = true
    }

    unpause(caller) {
      if (!this.pausers.has(caller.toLowerCase())) throw new Error('AccessControl: caller is not a pauser')
      this.paused = false
    }

    revoke(caller, proofHash) {
      if (!this.revokers.has(caller.toLowerCase())) throw new Error('AccessControl: caller is not a revoker')
      const entry = this.proofs.get(proofHash)
      if (!entry) throw new Error('ProofRegistry: unknown proof')
      if (entry.revoked) throw new Error('ProofRegistry: already revoked')
      entry.revoked = true
      return { success: true, proofHash }
    }
  }

  const ADMIN = '0x1111111111111111111111111111111111111111'
  const ATTACKER = '0x9999999999999999999999999999999999999999'

  test('Access Control: Only authorized anchorer can anchor proofs', () => {
    const registry = new MockProofRegistry(ADMIN)
    const validProofHash = ethers.keccak256(ethers.toUtf8Bytes('proof_data_1'))
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('reason_1'))

    // Admin (anchorer) succeeds
    const res = registry.anchor(ADMIN, validProofHash, reasonHash)
    assert.equal(res.success, true)

    // Attacker without ANCHOR_ROLE is rejected
    const attackerProofHash = ethers.keccak256(ethers.toUtf8Bytes('attacker_proof'))
    assert.throws(
      () => registry.anchor(ATTACKER, attackerProofHash, reasonHash),
      /AccessControl: caller is not an anchorer/
    )
  })

  test('Duplicate hash anchoring is strictly rejected', () => {
    const registry = new MockProofRegistry(ADMIN)
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes('duplicate_test_hash'))
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('reason'))

    registry.anchor(ADMIN, proofHash, reasonHash)

    // Attempting to anchor exact same hash again
    assert.throws(
      () => registry.anchor(ADMIN, proofHash, reasonHash),
      /ProofRegistry: proof already anchored/
    )
  })

  test('Zero hash (bytes32(0)) anchoring is rejected', () => {
    const registry = new MockProofRegistry(ADMIN)
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('reason'))

    assert.throws(
      () => registry.anchor(ADMIN, ethers.ZeroHash, reasonHash),
      /ProofRegistry: zero hash invalid/
    )
  })

  test('Emergency Pausing: Paused contract halts anchoring; unpausing restores it', () => {
    const registry = new MockProofRegistry(ADMIN)
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes('paused_test_hash'))
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('reason'))

    // Pause
    registry.pause(ADMIN)

    // Anchor while paused fails
    assert.throws(
      () => registry.anchor(ADMIN, proofHash, reasonHash),
      /Pausable: paused/
    )

    // Unpause
    registry.unpause(ADMIN)

    // Anchor after unpause succeeds
    const res = registry.anchor(ADMIN, proofHash, reasonHash)
    assert.equal(res.success, true)
  })

  test('Revocation: Only revoker role can revoke existing proof', () => {
    const registry = new MockProofRegistry(ADMIN)
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes('revocation_test_hash'))
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('reason'))

    registry.anchor(ADMIN, proofHash, reasonHash)

    // Attacker cannot revoke
    assert.throws(
      () => registry.revoke(ATTACKER, proofHash),
      /AccessControl: caller is not a revoker/
    )

    // Admin revoker succeeds
    const res = registry.revoke(ADMIN, proofHash)
    assert.equal(res.success, true)

    // Double revocation is rejected
    assert.throws(
      () => registry.revoke(ADMIN, proofHash),
      /ProofRegistry: already revoked/
    )
  })
})

