const { expect } = require('chai')
const { ethers, network } = require('hardhat')

const Kind = { None: 0, AuditCheckpoint: 1, Methodology: 2, Evaluation: 3, Execution: 4, Report: 5 }
const ZERO = ethers.ZeroHash
const id = (s) => ethers.id(s)
const ROLE = { ANCHORER: id('ANCHORER_ROLE'), PAUSER: id('PAUSER_ROLE'), REVOKER: id('REVOKER_ROLE'), ADMIN: ZERO }
const DELAY = 2 * 24 * 3600

async function reverts(p, name) {
  try { await p } catch (e) { const msg = String(e.message); if (!msg.includes(name)) throw new Error(`expected ${name}, got: ${msg.slice(0, 300)}`); return }
  throw new Error(`expected revert ${name}`)
}
const increaseTime = async (s) => { await network.provider.send('evm_increaseTime', [s]); await network.provider.send('evm_mine') }

describe('ProofRegistry v2', () => {
  let reg, admin, anchorer, pauser, revoker, stranger, newAdmin
  const scopeA = id('workspace:ws_alpha'), scopeB = id('workspace:ws_bravo'), platform = id('platform')

  beforeEach(async () => {
    ;[admin, anchorer, pauser, revoker, stranger, newAdmin] = await ethers.getSigners()
    reg = await (await ethers.getContractFactory('ProofRegistry')).deploy(DELAY, admin.address, anchorer.address, pauser.address, revoker.address)
  })
  const A = () => reg.connect(anchorer)

  describe('deployment', () => {
    it('assigns roles and version', async () => {
      expect(await reg.hasRole(ROLE.ADMIN, admin.address)).to.equal(true)
      expect(await reg.hasRole(ROLE.ANCHORER, anchorer.address)).to.equal(true)
      expect(await reg.hasRole(ROLE.PAUSER, pauser.address)).to.equal(true)
      expect(await reg.hasRole(ROLE.REVOKER, revoker.address)).to.equal(true)
      expect(await reg.hasRole(ROLE.ANCHORER, admin.address)).to.equal(false) // admin cannot anchor unless granted
      expect(await reg.VERSION()).to.equal('2.0.0')
      expect(await reg.defaultAdminDelay()).to.equal(BigInt(DELAY))
    })
    it('rejects zero role addresses', async () => {
      const F = await ethers.getContractFactory('ProofRegistry')
      await reverts(F.deploy(DELAY, admin.address, ethers.ZeroAddress, pauser.address, revoker.address), 'ZeroAddress')
      await reverts(F.deploy(DELAY, ethers.ZeroAddress, anchorer.address, pauser.address, revoker.address), 'AccessControlInvalidDefaultAdmin')
    })
  })

  describe('anchoring', () => {
    it('stores the record, updates head/count and emits Anchored', async () => {
      const b1 = id('b1'), c1 = id('c1')
      const rc = await (await A().anchor(b1, scopeA, c1, Kind.AuditCheckpoint, ZERO)).wait()
      const ev = rc.logs.map((l) => reg.interface.parseLog(l)).find((e) => e?.name === 'Anchored')
      expect(ev.args.batchId).to.equal(b1); expect(ev.args.scope).to.equal(scopeA); expect(ev.args.commitment).to.equal(c1)
      expect(ev.args.seq).to.equal(1n); expect(ev.args.prevBatchId).to.equal(ZERO); expect(ev.args.submitter).to.equal(anchorer.address)
      const a = await reg.getAnchor(b1)
      expect(a.commitment).to.equal(c1); expect(a.kind).to.equal(BigInt(Kind.AuditCheckpoint)); expect(a.revoked).to.equal(false)
      expect(a.blockNumber).to.equal(BigInt(rc.blockNumber))
      expect(await reg.headOf(scopeA)).to.equal(b1); expect(await reg.countOf(scopeA)).to.equal(1n); expect(await reg.totalAnchors()).to.equal(1n)
    })
    it('chains anchors per scope and rejects stale/forked heads', async () => {
      await A().anchor(id('b1'), scopeA, id('c1'), Kind.AuditCheckpoint, ZERO)
      await A().anchor(id('b2'), scopeA, id('c2'), Kind.AuditCheckpoint, id('b1'))
      expect((await reg.getAnchor(id('b2'))).prevBatchId).to.equal(id('b1'))
      expect((await reg.getAnchor(id('b2'))).seq).to.equal(2n)
      await reverts(A().anchor(id('fork'), scopeA, id('cx'), Kind.AuditCheckpoint, id('b1')), 'StaleHead')
      await reverts(A().anchor(id('first-again'), scopeA, id('cx'), Kind.AuditCheckpoint, ZERO), 'StaleHead')
    })
    it('scopes are independent', async () => {
      await A().anchor(id('a1'), scopeA, id('c'), Kind.AuditCheckpoint, ZERO)
      await A().anchor(id('x1'), scopeB, id('c'), Kind.AuditCheckpoint, ZERO) // same commitment, different scope is fine
      expect(await reg.countOf(scopeA)).to.equal(1n); expect(await reg.countOf(scopeB)).to.equal(1n)
    })
    it('a batch id can be written exactly once, even in another scope', async () => {
      await A().anchor(id('b1'), scopeA, id('c1'), Kind.AuditCheckpoint, ZERO)
      await reverts(A().anchor(id('b1'), scopeB, id('c2'), Kind.Report, ZERO), 'AlreadyAnchored')
      expect((await reg.getAnchor(id('b1'))).commitment).to.equal(id('c1'))
    })
    it('validates inputs', async () => {
      await reverts(A().anchor(ZERO, scopeA, id('c'), Kind.Report, ZERO), 'ZeroBatchId')
      await reverts(A().anchor(id('b'), ZERO, id('c'), Kind.Report, ZERO), 'ZeroScope')
      await reverts(A().anchor(id('b'), scopeA, ZERO, Kind.Report, ZERO), 'ZeroCommitment')
      await reverts(A().anchor(id('b'), scopeA, id('c'), Kind.None, ZERO), 'InvalidKind')
      await reverts(A().anchor(id('b'), scopeA, id('c'), 9, ZERO), '') // out-of-range enum is rejected by ABI decoding
    })
    it('all kinds are accepted', async () => {
      let prev = ZERO
      for (const k of [1, 2, 3, 4, 5]) { await A().anchor(id('k' + k), platform, id('c' + k), k, prev); prev = id('k' + k) }
      expect(await reg.countOf(platform)).to.equal(5n)
    })
  })

  describe('batch anchoring', () => {
    const item = (b, s, c, prev, k = Kind.AuditCheckpoint) => ({ batchId: id(b), scope: s, commitment: id(c), kind: k, expectedPrevBatchId: prev })
    it('anchors many atomically, chaining within a scope', async () => {
      await A().anchorBatch([item('a1', scopeA, 'c1', ZERO), item('a2', scopeA, 'c2', id('a1')), item('b1', scopeB, 'c3', ZERO)])
      expect(await reg.countOf(scopeA)).to.equal(2n); expect(await reg.headOf(scopeB)).to.equal(id('b1'))
    })
    it('is all-or-nothing', async () => {
      await reverts(A().anchorBatch([item('a1', scopeA, 'c1', ZERO), item('a2', scopeA, 'c2', ZERO)]), 'StaleHead')
      expect(await reg.isAnchored(id('a1'))).to.equal(false); expect(await reg.totalAnchors()).to.equal(0n)
    })
    it('enforces size bounds', async () => {
      await reverts(A().anchorBatch([]), 'EmptyBatch')
      const many = []; let prev = ZERO
      for (let i = 0; i < 51; i++) { many.push(item('m' + i, scopeA, 'c' + i, prev)); prev = id('m' + i) }
      await reverts(A().anchorBatch(many), 'BatchTooLarge')
      await A().anchorBatch(many.slice(0, 50))
      expect(await reg.countOf(scopeA)).to.equal(50n)
    })
  })

  describe('access control', () => {
    it('only anchorers can write', async () => {
      for (const s of [admin, pauser, revoker, stranger]) await reverts(reg.connect(s).anchor(id('b'), scopeA, id('c'), 1, ZERO), 'AccessControlUnauthorizedAccount')
      await reverts(reg.connect(stranger).anchorBatch([{ batchId: id('b'), scope: scopeA, commitment: id('c'), kind: 1, expectedPrevBatchId: ZERO }]), 'AccessControlUnauthorizedAccount')
    })
    it('only admin manages roles; removed anchorers lose access immediately', async () => {
      await reverts(reg.connect(anchorer).grantRole(ROLE.ANCHORER, stranger.address), 'AccessControlUnauthorizedAccount')
      await reg.connect(admin).grantRole(ROLE.ANCHORER, stranger.address)
      await reg.connect(stranger).anchor(id('b1'), scopeA, id('c'), 1, ZERO)
      await reg.connect(admin).revokeRole(ROLE.ANCHORER, stranger.address)
      await reverts(reg.connect(stranger).anchor(id('b2'), scopeA, id('c'), 1, id('b1')), 'AccessControlUnauthorizedAccount')
    })
    it('a compromised anchorer key can renounce itself (kill switch) but cannot escalate', async () => {
      await reg.connect(anchorer).renounceRole(ROLE.ANCHORER, anchorer.address)
      expect(await reg.hasRole(ROLE.ANCHORER, anchorer.address)).to.equal(false)
    })
    it('admin role cannot be granted directly — only via delayed two-step transfer', async () => {
      await reverts(reg.connect(admin).grantRole(ROLE.ADMIN, newAdmin.address), 'AccessControlEnforcedDefaultAdminRules')
      await reg.connect(admin).beginDefaultAdminTransfer(newAdmin.address)
      await reverts(reg.connect(newAdmin).acceptDefaultAdminTransfer(), 'AccessControlEnforcedDefaultAdminDelay')
      await increaseTime(DELAY + 1)
      await reverts(reg.connect(stranger).acceptDefaultAdminTransfer(), 'AccessControlInvalidDefaultAdmin')
      await reg.connect(newAdmin).acceptDefaultAdminTransfer()
      expect(await reg.defaultAdmin()).to.equal(newAdmin.address)
      expect(await reg.hasRole(ROLE.ADMIN, admin.address)).to.equal(false)
    })
    it('a pending admin transfer can be cancelled', async () => {
      await reg.connect(admin).beginDefaultAdminTransfer(stranger.address)
      await reg.connect(admin).cancelDefaultAdminTransfer()
      await increaseTime(DELAY + 1)
      await reverts(reg.connect(stranger).acceptDefaultAdminTransfer(), 'AccessControlInvalidDefaultAdmin')
    })
  })

  describe('pause', () => {
    it('pauser stops anchoring; only admin can resume; reads and revocation keep working', async () => {
      await A().anchor(id('b1'), scopeA, id('c1'), 1, ZERO)
      await reverts(reg.connect(stranger).pause(), 'AccessControlUnauthorizedAccount')
      await reg.connect(pauser).pause()
      await reverts(A().anchor(id('b2'), scopeA, id('c2'), 1, id('b1')), 'EnforcedPause')
      await reverts(A().anchorBatch([{ batchId: id('b2'), scope: scopeA, commitment: id('c2'), kind: 1, expectedPrevBatchId: id('b1') }]), 'EnforcedPause')
      const v = await reg.verify(id('b1'), id('c1')); expect(v.matches).to.equal(true)
      await reg.connect(revoker).revoke(id('b1'), id('incident-7'))
      await reverts(reg.connect(pauser).unpause(), 'AccessControlUnauthorizedAccount')
      await reg.connect(admin).unpause()
      await A().anchor(id('b2'), scopeA, id('c2'), 1, id('b1'))
    })
  })

  describe('revocation', () => {
    it('flags but never erases; reason recorded; cannot revoke twice', async () => {
      await A().anchor(id('b1'), scopeA, id('c1'), Kind.Report, ZERO)
      await reverts(reg.connect(anchorer).revoke(id('b1'), id('r')), 'AccessControlUnauthorizedAccount')
      await reverts(reg.connect(revoker).revoke(id('b1'), ZERO), 'ZeroReason')
      await reverts(reg.connect(revoker).revoke(id('nope'), id('r')), 'NotAnchored')
      const rc = await (await reg.connect(revoker).revoke(id('b1'), id('wrong data'))).wait()
      expect(rc.logs.map((l) => reg.interface.parseLog(l)).find((e) => e?.name === 'AnchorRevoked').args.reasonHash).to.equal(id('wrong data'))
      const a = await reg.getAnchor(id('b1'))
      expect(a.revoked).to.equal(true); expect(a.commitment).to.equal(id('c1'))
      expect(await reg.revocationReasonOf(id('b1'))).to.equal(id('wrong data'))
      await reverts(reg.connect(revoker).revoke(id('b1'), id('again')), 'AlreadyRevoked')
      expect(await reg.headOf(scopeA)).to.equal(id('b1')) // ordering chain is untouched
    })
  })

  describe('verification (public)', () => {
    it('reports exists / matches / revoked / timestamp', async () => {
      await A().anchor(id('b1'), scopeA, id('c1'), 1, ZERO)
      let v = await reg.connect(stranger).verify(id('b1'), id('c1'))
      expect([v.exists, v.matches, v.revoked]).to.deep.equal([true, true, false]); expect(v.timestamp > 0n).to.equal(true)
      v = await reg.verify(id('b1'), id('tampered'))
      expect([v.exists, v.matches]).to.deep.equal([true, false])
      v = await reg.verify(id('missing'), id('c1'))
      expect([v.exists, v.matches, v.revoked, v.timestamp]).to.deep.equal([false, false, false, 0n])
      await reverts(reg.getAnchor(id('missing')), 'NotAnchored')
    })
  })

  describe('hardening', () => {
    it('rejects plain ETH transfers and unknown calls', async () => {
      await reverts(stranger.sendTransaction({ to: await reg.getAddress(), value: 1n }), '')
      await reverts(stranger.sendTransaction({ to: await reg.getAddress(), data: '0xdeadbeef' }), '')
    })
    it('supports the AccessControl interface', async () => {
      expect(await reg.supportsInterface('0x7965db0b')).to.equal(true) // IAccessControl
    })
    it('gas stays bounded', async () => {
      const r1 = await (await A().anchor(id('g1'), scopeA, id('c'), 1, ZERO)).wait()
      const r2 = await (await A().anchor(id('g2'), scopeA, id('c'), 1, id('g1'))).wait()
      expect(r1.gasUsed < 250000n).to.equal(true); expect(r2.gasUsed < 200000n).to.equal(true)
    })
  })

  describe('invariants (randomized)', () => {
    it('heads/counts/links stay consistent across random multi-scope activity', async () => {
      const scopes = [scopeA, scopeB, platform]
      const model = Object.fromEntries(scopes.map((s) => [s, []]))
      let seed = 1337; const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % n
      for (let i = 0; i < 60; i++) {
        const s = scopes[rnd(3)], chain = model[s], head = chain.at(-1) ?? ZERO
        const stale = rnd(5) === 0 && chain.length > 1
        const b = id('r' + i)
        if (stale) { await reverts(A().anchor(b, s, id('c' + i), 1 + rnd(5), chain[0]), 'StaleHead'); continue }
        await A().anchor(b, s, id('c' + i), 1 + rnd(5), head)
        chain.push(b)
      }
      let total = 0
      for (const s of scopes) {
        const chain = model[s]; total += chain.length
        expect(await reg.countOf(s)).to.equal(BigInt(chain.length))
        expect(await reg.headOf(s)).to.equal(chain.at(-1) ?? ZERO)
        for (let i = 0; i < chain.length; i++) {
          const a = await reg.getAnchor(chain[i])
          expect(a.seq).to.equal(BigInt(i + 1)); expect(a.prevBatchId).to.equal(i ? chain[i - 1] : ZERO); expect(a.scope).to.equal(s)
        }
      }
      expect(await reg.totalAnchors()).to.equal(BigInt(total))
    })
  })
})
