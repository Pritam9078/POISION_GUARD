// Writes abi/ProofRegistry.json (ABI only) for the backend, frontend and third-party verifiers.
const fs = require('fs'), path = require('path')
const art = require('../artifacts/src/ProofRegistry.sol/ProofRegistry.json')
fs.mkdirSync(path.join(__dirname, '../abi'), { recursive: true })
fs.writeFileSync(path.join(__dirname, '../abi/ProofRegistry.json'), JSON.stringify({ contractName: 'ProofRegistry', version: '2.0.0', abi: art.abi }, null, 2))
console.log('wrote abi/ProofRegistry.json')
