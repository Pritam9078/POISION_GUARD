require('@nomicfoundation/hardhat-ethers')
const { subtask } = require('hardhat/config')
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names')

// Offline/air-gapped builds: set HARDHAT_LOCAL_SOLC=1 to use the npm-shipped solcjs instead of downloading a compiler.
if (process.env.HARDHAT_LOCAL_SOLC === '1') {
  subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
    const solc = require('solc')
    const long = solc.version().replace('.Emscripten.clang', '')
    if (!long.startsWith(args.solcVersion)) return runSuper()
    return { compilerPath: require.resolve('solc/soljson.js'), isSolcJs: true, version: args.solcVersion, longVersion: long }
  })
}

/** Solidity is used ONLY for the optional proof-anchor registry. */
module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: { sources: './src', tests: './test' },
  networks: {
    hardhat: { chainId: 11155111 }, // lets the API treat the local node as its Sepolia adapter in e2e tests
    localhost: { url: 'http://127.0.0.1:8545' },
    sepolia: { url: process.env.SEPOLIA_RPC_URL || 'http://127.0.0.1:0', accounts: process.env.PROOF_ANCHOR_PRIVATE_KEY ? [process.env.PROOF_ANCHOR_PRIVATE_KEY] : [] },
  },
}
