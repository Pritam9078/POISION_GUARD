import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { JsonRpcProvider } from 'ethers'

describe('Integration: Sepolia Public Testnet Smoke Tests', () => {
  const enabled = process.env.ENABLE_SEPOLIA_TESTS === 'true'
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo'

  test('Sepolia Smoke Test - validates chainId and RPC connectivity', { skip: !enabled && 'Sepolia tests disabled (requires ENABLE_SEPOLIA_TESTS=true)' }, async () => {
    const provider = new JsonRpcProvider(rpcUrl)
    const network = await provider.getNetwork()
    assert.equal(Number(network.chainId), 11155111, 'Must connect to Sepolia network (chainId 11155111)')
    const blockNumber = await provider.getBlockNumber()
    assert.ok(blockNumber > 0, 'Must retrieve current block number on Sepolia')
  })
})

