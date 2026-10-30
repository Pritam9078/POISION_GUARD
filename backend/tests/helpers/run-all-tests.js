#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '../../')

console.log('═══════════════════════════════════════════════════════════════')
console.log('   POISONGUARD AUTOMATED TEST SUITE: COMPLETE EXECUTION')
console.log('═══════════════════════════════════════════════════════════════\n')

const results = []

function runStep(name, cmd, args, extraEnv = {}) {
  console.log(`\n▶ [Executing]: ${name}...`)
  const start = Date.now()
  const proc = spawnSync(cmd, args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
  const duration = ((Date.now() - start) / 1000).toFixed(1)
  const passed = proc.status === 0
  results.push({ name, passed, duration, code: proc.status })
  if (passed) {
    console.log(`✔ [Passed]: ${name} (${duration}s)`)
  } else {
    console.log(`✖ [Failed]: ${name} (exit code ${proc.status}, ${duration}s)`)
  }
  return passed
}

// 1. API Test Suite
runStep('API Test Suite', 'node', ['tests/helpers/run-api-tests.js'])

// 2. Integration Test Suite
runStep('Integration Test Suite', 'node', ['tests/helpers/run-integration-tests.js'])

// 3. Security Test Suite
runStep('Security Test Suite', 'node', ['tests/helpers/run-security-tests.js'])

// 4. Playwright E2E Desktop & Mobile
runStep('Playwright E2E Suite (Public, Auth, Dashboard, Scanner)', 'npx', [
  'playwright', 'test',
  '--config=tests/playwright.config.js',
  '--project=desktop-chrome',
  'tests/e2e/public-pages',
  'tests/e2e/auth',
  'tests/e2e/scanner',
  'tests/e2e/approvals',
])

// 5. Playwright E2E Admin Portal
runStep('Playwright E2E Admin Portal', 'npx', [
  'playwright', 'test',
  '--config=tests/playwright.config.js',
  '--project=admin-portal',
  'tests/e2e/admin',
])

// 6. Test Data Cleanup
runStep('Automated Test Data Cleanup', 'node', ['tests/cleanup/cleanup.js'])

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('   FINAL TEST EXECUTION SUMMARY')
console.log('═══════════════════════════════════════════════════════════════')
console.table(results)

const allPassed = results.every(r => r.passed)
if (allPassed) {
  console.log('🎉 ALL TEST SUITES PASSED CLEANLY!')
  process.exit(0)
} else {
  console.error('⚠️ ONE OR MORE TEST SUITES ENCOUNTERED FAILURES.')
  process.exit(1)
}
