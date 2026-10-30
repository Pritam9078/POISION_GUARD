import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contractsDir = path.resolve(__dirname, '../../../contracts')

describe('Integration: Local EVM Blockchain & Smart Contracts', () => {
  test('ProofRegistry.sol - executes full hardhat contract test suite locally', () => {
    console.log('   Running Hardhat contract tests in backend/contracts...')
    const output = execSync('npx hardhat test', {
      cwd: contractsDir,
      encoding: 'utf-8',
      env: { ...process.env, NODE_ENV: 'test' },
    })
    assert.ok(output.includes('passing'), 'Hardhat tests must pass')
    assert.ok(output.includes('ProofRegistry v2'), 'ProofRegistry v2 suite executed')
  })
})

