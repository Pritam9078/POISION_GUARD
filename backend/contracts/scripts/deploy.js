/**
 * Deploy ProofRegistry v2.
 *   ADMIN_ADDRESS=<multisig> ANCHORER_ADDRESS=<backend key> PAUSER_ADDRESS=<on-call> REVOKER_ADDRESS=<security> \
 *   ADMIN_DELAY_SECONDS=172800 npx hardhat run scripts/deploy.js --network sepolia
 * Always deploy to a testnet first. Writes deployments/<network>.json.
 */
const { ethers, network } = require('hardhat')
const fs = require('fs'), path = require('path')

async function main() {
  const [deployer] = await ethers.getSigners()
  const need = (k, fallback) => { const v = process.env[k] || fallback; if (!v || !ethers.isAddress(v)) throw new Error(`${k} must be a valid address`); return ethers.getAddress(v) }
  const local = ['hardhat', 'localhost'].includes(network.name)
  const admin = need('ADMIN_ADDRESS', local ? deployer.address : undefined)
  const anchorer = need('ANCHORER_ADDRESS', local ? deployer.address : undefined)
  const pauser = need('PAUSER_ADDRESS', local ? deployer.address : undefined)
  const revoker = need('REVOKER_ADDRESS', local ? deployer.address : undefined)
  const delay = Number(process.env.ADMIN_DELAY_SECONDS ?? (local ? 0 : 172800))
  if (!local && delay < 86400) throw new Error('ADMIN_DELAY_SECONDS must be >= 86400 on public networks')
  if (!local && admin === anchorer) throw new Error('Admin and anchorer must be different keys on public networks')

  const reg = await (await ethers.getContractFactory('ProofRegistry')).deploy(delay, admin, anchorer, pauser, revoker)
  await reg.waitForDeployment()
  const tx = reg.deploymentTransaction(); const rc = await tx.wait()
  const out = { network: network.name, chainId: Number((await ethers.provider.getNetwork()).chainId), address: await reg.getAddress(), deployTx: tx.hash, blockNumber: rc.blockNumber,
    version: await reg.VERSION(), roles: { admin, anchorer, pauser, revoker }, adminDelaySeconds: delay, constructorArgs: [delay, admin, anchorer, pauser, revoker], deployedAt: new Date().toISOString() }
  fs.mkdirSync(path.join(__dirname, '../deployments'), { recursive: true })
  fs.writeFileSync(path.join(__dirname, `../deployments/${network.name}.json`), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  console.log(`\nNext: npx hardhat verify --network ${network.name} ${out.address} ${out.constructorArgs.join(' ')}`)
  console.log('Backend env: PROOF_REGISTRY_CHAIN_ID=%s PROOF_REGISTRY_ADDRESS=%s (PROOF_ANCHOR_PRIVATE_KEY = the ANCHORER key)', out.chainId, out.address)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
