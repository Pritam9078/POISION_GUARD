import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Queues: Worker Resilience & Distributed Job Processing Suite', () => {
  // Mock distributed worker queue matching BullMQ architecture
  class MockBullQueue {
    constructor(name) {
      this.name = name
      this.jobs = new Map() // jobId -> job
      this.deadLetterQueue = []
      this.processedCount = 0
    }

    add(jobName, data, { jobId, attempts = 3 } = {}) {
      if (jobId && this.jobs.has(jobId)) {
        return { queued: false, duplicate: true, job: this.jobs.get(jobId) }
      }
      const job = {
        id: jobId || `job_${Date.now()}_${Math.random()}`,
        name: jobName,
        data,
        attemptsMade: 0,
        maxAttempts: attempts,
        status: 'waiting',
      }
      this.jobs.set(job.id, job)
      return { queued: true, duplicate: false, job }
    }

    async process(handler) {
      for (const [id, job] of this.jobs.entries()) {
        if (job.status === 'completed' || job.status === 'failed') continue
        while (job.attemptsMade < job.maxAttempts) {
          job.attemptsMade++
          try {
            await handler(job)
            job.status = 'completed'
            this.processedCount++
            break
          } catch (err) {
            if (job.attemptsMade >= job.maxAttempts) {
              job.status = 'failed'
              job.failedReason = err.message
              this.deadLetterQueue.push(job)
            }
          }
        }
      }
    }
  }

  test('Job Deduplication: Duplicate scan requests with same hash are deduplicated by queue', () => {
    const queue = new MockBullQueue('scan-queue')
    const scanPayload = { chainId: 1, address: '0x1111111111111111111111111111111111111111' }
    const deterministicJobId = 'scan_1_0x1111111111111111111111111111111111111111'

    // First submission
    const res1 = queue.add('address-scan', scanPayload, { jobId: deterministicJobId })
    assert.equal(res1.queued, true)
    assert.equal(res1.duplicate, false)

    // Second simultaneous submission
    const res2 = queue.add('address-scan', scanPayload, { jobId: deterministicJobId })
    assert.equal(res2.queued, false)
    assert.equal(res2.duplicate, true)
    assert.equal(queue.jobs.size, 1, 'Queue must contain exactly 1 job')
  })

  test('Poison Pill Containment: Malformed payload moves to DLQ without crashing worker', async () => {
    const queue = new MockBullQueue('analysis-queue')

    // Add poison pill job (corrupted data)
    queue.add('process-finding', { corrupted: true, missingRequiredField: null }, { jobId: 'poison_1', attempts: 2 })

    // Normal job
    queue.add('process-finding', { corrupted: false, findingId: 'fnd_normal_1' }, { jobId: 'normal_1', attempts: 2 })

    // Worker processing function
    await queue.process(async (job) => {
      if (job.data.corrupted) {
        throw new Error('CORRUPTED_PAYLOAD_UNPARSEABLE')
      }
      return { success: true }
    })

    // Poison pill job moved to dead letter queue after 2 failed attempts
    const poisonJob = queue.jobs.get('poison_1')
    assert.equal(poisonJob.status, 'failed')
    assert.equal(poisonJob.attemptsMade, 2)
    assert.equal(queue.deadLetterQueue.length, 1)

    // Normal job completed successfully
    const normalJob = queue.jobs.get('normal_1')
    assert.equal(normalJob.status, 'completed')
  })

  test('Worker Max Retries: Transient failure is retried and succeeds on retry', async () => {
    const queue = new MockBullQueue('notification-queue')
    queue.add('send-webhook', { url: 'https://webhook.site/test' }, { jobId: 'notif_1', attempts: 3 })

    let attempts = 0
    await queue.process(async (job) => {
      attempts++
      if (attempts < 2) {
        throw new Error('TRANSIENT_NETWORK_TIMEOUT')
      }
      return { sent: true }
    })

    const job = queue.jobs.get('notif_1')
    assert.equal(job.status, 'completed')
    assert.equal(job.attemptsMade, 2)
  })
})

