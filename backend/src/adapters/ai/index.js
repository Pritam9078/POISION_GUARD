import { createHash } from 'node:crypto'
import { env } from '../../config/env.js'

/**
 * Provider-independent LLM + embedding adapters. "none" = not configured (callers must say so);
 * "mock" = deterministic local stand-in, always labelled as such in responses.
 */
export function createLlm() {
  const p = env.AI_PROVIDER
  if (p === 'none') return null
  if (p === 'mock') return {
    name: 'mock', model: 'mock-deterministic',
    async complete({ system, messages }) {
      const last = messages.at(-1)?.content || ''
      const cites = [...last.matchAll(/<source id="(S\d+)"/g)].map((m) => m[1])
      return `[MOCK AI PROVIDER — not a real model] Based on ${cites.length ? cites.join(', ') : 'no retrieved sources'}: ${cites.length ? 'the retrieved documents address this question; see the cited excerpts.' : 'I could not find authorized sources for this question.'}`
    },
  }
  if (!env.AI_API_KEY || !env.AI_MODEL) return null
  if (p === 'anthropic') return {
    name: 'anthropic', model: env.AI_MODEL,
    async complete({ system, messages, maxTokens = 800 }) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.AI_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: env.AI_MODEL, max_tokens: maxTokens, system, messages }) })
      if (!r.ok) throw new Error(`AI provider HTTP ${r.status}`)
      const j = await r.json()
      return j.content?.filter((c) => c.type === 'text').map((c) => c.text).join('\n') ?? ''
    },
  }
  if (p === 'openai') return {
    name: 'openai', model: env.AI_MODEL,
    async complete({ system, messages, maxTokens = 800 }) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: env.AI_MODEL, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages] }) })
      if (!r.ok) throw new Error(`AI provider HTTP ${r.status}`)
      return (await r.json()).choices?.[0]?.message?.content ?? ''
    },
  }
  return null
}

let localPipe = null
/** Pretrained sentence-embedding model run locally (ONNX via transformers.js). No API key, no data leaves the server. */
async function localPipeline() {
  if (!localPipe) localPipe = (async () => {
    const { pipeline, env: tenv } = await import('@huggingface/transformers')
    if (env.EMBEDDING_MODEL_PATH) { tenv.localModelPath = env.EMBEDDING_MODEL_PATH.replace(/\/?$/, '/'); tenv.allowRemoteModels = false }
    if (env.EMBEDDING_CACHE_DIR) tenv.cacheDir = env.EMBEDDING_CACHE_DIR
    return pipeline('feature-extraction', env.EMBEDDING_LOCAL_MODEL, { dtype: env.EMBEDDING_LOCAL_DTYPE })
  })()
  return localPipe
}

export function createEmbedder() {
  const p = env.EMBEDDING_PROVIDER
  if (p === 'local') return {
    name: 'local', model: env.EMBEDDING_LOCAL_MODEL, dims: 384,
    async embed(texts) {
      const pipe = await localPipeline()
      const out = []
      for (let i = 0; i < texts.length; i += 16) {
        const t = await pipe(texts.slice(i, i + 16).map((x) => String(x).slice(0, 2000)), { pooling: 'mean', normalize: true })
        const [n, d] = t.dims
        for (let j = 0; j < n; j++) out.push(Array.from(t.data.slice(j * d, (j + 1) * d)))
      }
      return out
    },
  }
  if (p === 'mock') return {
    name: 'mock', model: 'mock-hash-256', dims: 256,
    async embed(texts) {
      // Deterministic bag-of-words hashing — only for local dev/tests, has no semantic quality.
      return texts.map((t) => {
        const v = new Array(256).fill(0)
        for (const w of t.toLowerCase().match(/[a-z0-9]{3,}/g) || []) v[createHash('md5').update(w).digest().readUInt16BE(0) % 256] += 1
        const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
        return v.map((x) => x / n)
      })
    },
  }
  if (p === 'openai' && env.EMBEDDING_API_KEY) return {
    name: 'openai', model: env.EMBEDDING_MODEL, dims: null,
    async embed(texts) {
      const r = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${env.EMBEDDING_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: env.EMBEDDING_MODEL, input: texts }) })
      if (!r.ok) throw new Error(`Embedding provider HTTP ${r.status}`)
      return (await r.json()).data.map((d) => d.embedding)
    },
  }
  return null
}
