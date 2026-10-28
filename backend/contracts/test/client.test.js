const { expect } = require('chai')
const { ethers } = require('hardhat')
const { ProofRegistryClient, Kind, scopeOf } = require('../client/proof-registry.js')

describe('client/proof-registry.js', () => {
  it('anchors with auto head, confirms from receipt, verifies, walks the scope, reports revocation', async () => {
    const [admin, anchorer] = await ethers.getSigners()
    const reg = await (await ethers.getContractFactory('ProofRegistry')).deploy(0, admin.address, anchorer.address, admin.address, admin.address)
    const w = new ProofRegistryClient(await reg.getAddress(), anchorer)
    const r = new ProofRegistryClient(await reg.getAddress(), ethers.provider)
    const scope = scopeOf('ws_test')
    for (let i = 1; i <= 3; i++) {
      const p = { batchId: ethers.id('b' + i), scope, commitment: ethers.id('c' + i), kind: Kind.AuditCheckpoint }
      const sent = await w.anchor(p)
      const conf = w.confirmFromReceipt(await sent.wait(), p)
      expect(conf.ok).to.equal(true); expect(conf.seq).to.equal(i)
    }
    expect(w.confirmFromReceipt({ status: 1, logs: [] }, { batchId: ethers.id('b1'), commitment: ethers.id('c1') }).ok).to.equal(false)
    expect((await r.verify(ethers.id('b2'), ethers.id('c2'))).valid).to.equal(true)
    expect((await r.verify(ethers.id('b2'), ethers.id('x'))).valid).to.equal(false)
    const walk = await r.walkScope(scope)
    expect(walk.complete).to.equal(true); expect(walk.broken).to.equal(null); expect(walk.anchors.map((a) => a.seq)).to.deep.equal([1, 2, 3])
    await reg.connect(admin).revoke(ethers.id('b2'), ethers.id('bad'))
    const v = await r.verify(ethers.id('b2'), ethers.id('c2'))
    expect(v.revoked).to.equal(true); expect(v.valid).to.equal(false)
    expect((await r.getAnchor(ethers.id('b2'))).revocationReasonHash).to.equal(ethers.id('bad'))
    expect(await r.getAnchor(ethers.id('nope'))).to.equal(null)
  })
})
