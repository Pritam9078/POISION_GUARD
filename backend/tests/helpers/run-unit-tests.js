#!/usr/bin/env node
import { run } from 'node:test'
import { spec } from 'node:test/reporters'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const unitDir = path.resolve(__dirname, '../unit')

function getTestFiles(dir) {
  let results = []
  if (!fs.existsSync(dir)) return results
  const list = fs.readdirSync(dir)
  list.forEach(file => {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat && stat.isDirectory()) {
      results = results.concat(getTestFiles(fullPath))
    } else if (file.endsWith('.test.js')) {
      results.push(fullPath)
    }
  })
  return results.sort()
}

const files = getTestFiles(unitDir)
console.log(`🚀 [PoisonGuard CI] Running Unit Test Suite (${files.length} test suites)...`)

const stream = run({ files, concurrency: 1 })
stream.compose(new spec()).pipe(process.stdout)

stream.on('test:fail', () => {
  process.exitCode = 1
})
