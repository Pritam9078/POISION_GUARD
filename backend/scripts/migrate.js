import { runMigrations } from '../src/db/migrate.js'
import { pool } from '../src/db/index.js'
await runMigrations()
await pool.end()
