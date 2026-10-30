#!/usr/bin/env node
import { run } from 'node:test'
import { spec } from 'node:test/reporters'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(__dirname, '../api')

function getTestFiles(dir) {
  let results = []
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
  return results
}

const files = getTestFiles(apiDir)
console.log(`🚀 [PoisonGuard QA] Running API Test Suite (${files.length} test suites)...`)

run({ files, concurrency: 1 })
  .compose(new spec())
  .pipe(process.stdout)
