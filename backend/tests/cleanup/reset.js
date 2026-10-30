#!/usr/bin/env node
import { testPool } from '../helpers/db.helper.js'
import { runMigrations } from '../../src/db/migrate.js'
import { seedReference } from '../../src/db/seed-reference.js'

async function runReset() {
  console.log('🔄 [PoisonGuard QA] Resetting Isolated Test Database (poisonguard_test)...')
  const client = await testPool.connect()
  try {
    // Drop all tables in public schema
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    console.log('✅ Schema dropped and recreated.')
    
    // Run all migrations
    await runMigrations(() => {})
    console.log('✅ Migrations executed successfully.')

    // Seed reference data
    await seedReference()
    console.log('✅ Reference data seeded successfully.')

    console.log('🎉 [PoisonGuard QA] Test database reset complete.')
  } catch (err) {
    console.error('❌ [PoisonGuard QA] Reset failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await testPool.end()
  }
}

runReset()
