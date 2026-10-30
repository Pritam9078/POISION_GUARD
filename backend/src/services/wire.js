import { setService, hasService } from './registry.js'
import { createJobs } from './jobs.js'
import { createEmailAdapter } from '../adapters/email/index.js'
import { getEvmAdapter } from '../adapters/chains/evm.js'
import { EtherscanIndexer } from '../adapters/chains/etherscan.js'
import { registerJobHandlers } from '../workers/handlers.js'

/** Production wiring. Tests call this, then override individual services with setService(). */
export function wireServices(log, overrides = {}) {
  const indexer = new EtherscanIndexer()
  if (!hasService('chains') || overrides.force) setService('chains', { adapter: (id) => getEvmAdapter(id), indexer: () => (indexer.configured ? indexer : null) })
  if (!hasService('email') || overrides.force) setService('email', createEmailAdapter(log))
  if (!hasService('jobs') || overrides.force) {
    const jobs = createJobs(log)
    registerJobHandlers(jobs, log)
    setService('jobs', jobs)
  }
  setService('log', log)
}
