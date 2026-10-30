#!/usr/bin/env node
import { cleanTestRunData, testPool } from '../helpers/db.helper.js'

async function runCleanup() {
  console.log('🧹 [PoisonGuard QA] Starting Test Data Cleanup...')
  try {
    const result = await cleanTestRunData()
    console.log(`✅ [PoisonGuard QA] Successfully cleaned test data for prefix: ${result.prefix}`)
  } catch (err) {
    console.error('❌ [PoisonGuard QA] Cleanup failed:', err.message)
    process.exit(1)
  } finally {
    await testPool.end()
  }
}

runCleanup()

