/**
 * Independent verification — anyone can run this, no PoisonGuard account or key needed.
 *   REGISTRY=0x… BATCH_ID=0x… COMMITMENT=0x… npx hardhat run scripts/verify-anchor.js --network sepolia
 * Optional SCOPE=0x… walks and checks the whole ordered chain for that scope.
 */
const { ethers } = require('hardhat')
const { ProofRegistryClient } = require('../client/proof-registry.js')

async function main() {
  const c = new ProofRegistryClient(process.env.REGISTRY, ethers.provider)
  if (process.env.BATCH_ID) {
    const a = await c.getAnchor(process.env.BATCH_ID)
    const v = process.env.COMMITMENT ? await c.verify(process.env.BATCH_ID, process.env.COMMITMENT) : null
    console.log(JSON.stringify({ anchor: a, verification: v, verdict: !a ? 'NOT ANCHORED' : v ? (v.valid ? 'VALID' : v.revoked ? 'REVOKED' : 'COMMITMENT MISMATCH') : 'ANCHORED (no commitment supplied to compare)' }, null, 2))
  }
  if (process.env.SCOPE) { const w = await c.walkScope(process.env.SCOPE); console.log(JSON.stringify({ scope: process.env.SCOPE, length: w.anchors.length, complete: w.complete, broken: w.broken }, null, 2)) }
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1) })
