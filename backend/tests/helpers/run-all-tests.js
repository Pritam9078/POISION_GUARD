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

// 2. Integration & Adversarial Test Suite
runStep('Integration & Adversarial Test Suite', 'node', ['tests/helpers/run-integration-tests.js'])

// 3. Security & Workspace Authorization Matrix Suite
runStep('Security & Authorization Matrix Suite', 'node', ['tests/helpers/run-security-tests.js'])

// 4. Address Poisoning Detection Evaluation & Unit Suite
runStep('Address Poisoning Detection Evaluation Suite', 'node', ['--test', 'tests/unit/address-poisoning-eval.test.js'])

// 5. Performance Latency Baseline Suite
runStep('Performance Latency Baseline Suite', 'node', ['--test', 'tests/performance/load-test.js'])

// 6. Playwright E2E Suite (Public, Auth, Dashboard, Scanner, Deep-Nav, Forms, Accessibility)
runStep('Playwright E2E Suite (Public, Auth, Dashboard, Deep-Nav, Forms, A11y)', 'npx', [
  'playwright', 'test',
  '--config=tests/playwright.config.js',
  '--project=desktop-chrome',
  'tests/e2e/public-pages',
  'tests/e2e/auth',
  'tests/e2e/scanner',
  'tests/e2e/approvals',
  'tests/e2e/deep-nav',
  'tests/e2e/deep-forms',
  'tests/e2e/accessibility',
])

// 7. Playwright E2E Admin Portal
runStep('Playwright E2E Admin Portal', 'npx', [
  'playwright', 'test',
  '--config=tests/playwright.config.js',
  '--project=admin-portal',
  'tests/e2e/admin',
])

// 8. Test Data Cleanup
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

