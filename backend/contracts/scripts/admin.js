/**
 * Admin / operations CLI (run with the key that holds the needed role).
 *   REGISTRY=0x… npx hardhat run scripts/admin.js --network sepolia -- <command> [args]
 * Hardhat swallows argv, so pass the command via env:  CMD="grant-anchorer 0xabc" REGISTRY=0x… npx hardhat run scripts/admin.js --network sepolia
 *
 * Commands:
 *   status                              roles, pause state, pending admin transfer, totals
 *   grant-anchorer|revoke-anchorer <addr>
 *   grant-pauser|revoke-pauser <addr>
 *   grant-revoker|revoke-revoker <addr>
 *   pause | unpause
 *   revoke-anchor <batchId> <reason text>   (reason is hashed; keep the text off-chain)
 *   begin-admin-transfer <addr> | accept-admin-transfer | cancel-admin-transfer
 */
const { ethers } = require('hardhat')
const ROLES = { anchorer: ethers.id('ANCHORER_ROLE'), pauser: ethers.id('PAUSER_ROLE'), revoker: ethers.id('REVOKER_ROLE') }

async function main() {
  const reg = await ethers.getContractAt('ProofRegistry', process.env.REGISTRY || require('../deployments/' + (process.env.HARDHAT_NETWORK || 'localhost') + '.json').address)
  const [cmd, ...args] = (process.env.CMD || 'status').split(/\s+/)
  const send = async (p) => { const tx = await p; const rc = await tx.wait(); console.log(`ok · tx ${tx.hash} · block ${rc.blockNumber}`) }
  const m = cmd.match(/^(grant|revoke)-(anchorer|pauser|revoker)$/)
  if (m) { if (!ethers.isAddress(args[0])) throw new Error('address required'); return send(reg[m[1] === 'grant' ? 'grantRole' : 'revokeRole'](ROLES[m[2]], args[0])) }
  switch (cmd) {
    case 'status': {
      const [admin, pending, paused, total, delay] = await Promise.all([reg.defaultAdmin(), reg.pendingDefaultAdmin(), reg.paused(), reg.totalAnchors(), reg.defaultAdminDelay()])
      return console.log(JSON.stringify({ address: await reg.getAddress(), version: await reg.VERSION(), admin, pendingAdmin: pending[0], pendingAdminAcceptAfter: Number(pending[1]) ? new Date(Number(pending[1]) * 1000).toISOString() : null, adminDelaySeconds: Number(delay), paused, totalAnchors: total.toString() }, null, 2))
    }
    case 'pause': return send(reg.pause())
    case 'unpause': return send(reg.unpause())
    case 'revoke-anchor': { const [batchId, ...why] = args; if (!why.length) throw new Error('reason text required'); console.log('reasonHash', ethers.id(why.join(' '))); return send(reg.revoke(batchId, ethers.id(why.join(' ')))) }
    case 'begin-admin-transfer': return send(reg.beginDefaultAdminTransfer(args[0]))
    case 'accept-admin-transfer': return send(reg.acceptDefaultAdminTransfer())
    case 'cancel-admin-transfer': return send(reg.cancelDefaultAdminTransfer())
    default: throw new Error(`Unknown command "${cmd}"`)
  }
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1) })
