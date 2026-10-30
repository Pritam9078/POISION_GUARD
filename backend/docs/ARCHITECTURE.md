# Architecture

**Modular monolith** (Fastify 5, Node 22, ES modules, JavaScript only) + PostgreSQL 16 (pgvector) + optional Redis/BullMQ worker. One API serves three audiences on separate auth planes:

| Plane | Prefix | Identity | Session |
|---|---|---|---|
| Public | `/api/v1/*` | anonymous | — (rate-limited, IP hashed) |
| Guard | `/api/v1/auth`, `/api/v1/workspaces/:id/*` | `users` | `pg_sid` httpOnly cookie, keyed-hash in `sessions` |
| Agents | `/api/v1/agent/v1/*` | `agents` | `Bearer pgk_live_…` (keyed hash in `agent_credentials`) |
| Staff | `/api/v1/admin/*` | `staff_users` (separate table) | `pg_staff_sid` cookie + mandatory TOTP |
| Providers | `/api/v1/webhooks/*` | signature | Standard Webhooks HMAC |

```
src/
  app.js / server.js          Fastify bootstrap, plugins, route registration; server runs migrations + reference seed
  config/env.js               zod-validated environment (refuses to boot in production without secrets)
  db/                          pg pool + tiny helpers (insert/update/tx), SQL migration runner, reference seed
  plugins/core.js             request context, session resolution, Origin (CSRF) check, error envelope, guards
  shared/                      states (state machines), permissions (capability matrix), validate, crypto, chains registry
  adapters/                    chains (ethers JSON-RPC, Etherscan V2), ai (LLM/embeddings), graph (TigerGraph), payments (Dodo), email
  modules/
    scanner/                   rules.js (pure deterministic engine) · scan.service.js (data collection + persistence + DTOs)
    recipients/ approvals/     pre-send check · revoke preview/verify
    policies/engine.js         pure deterministic policy evaluation
    intents/                   lifecycle (create→evaluate→approve→prepare→submit) · execution reconciliation
    agents/                    registry/credentials · machine API
    audit/ proofs/             hash-chained audit log · checkpoints & on-chain anchoring
    knowledge/                 chunking, hybrid retrieval (FTS + pgvector, RRF), grounded assistant
    billing/ notifications/ incidents/ wallets/ workspaces/ graph/ flags/ admin/
  routes/                      workspace router (tenant scoping) · admin router
  workers/                     handlers.js (all jobs, idempotent) · index.js (BullMQ worker)
migrations/001_init.sql        67 tables, append-only audit trigger, generated tsvector, vector column
contracts/                     ProofRegistry.sol (+ Hardhat tests); test-fixtures/TestToken.sol for e2e only
```

## Key decisions

- **PostgreSQL is the system of record.** TigerGraph mirrors relationships (optional); vector search never answers live-state questions.
- **Deterministic core.** `rules.js` and `policies/engine.js` are pure functions with unit tests. AI output is never an input to either.
- **State machines** (`shared/states.js`) guard every status change: scans, intents, revocations, incidents, reports.
- **Approval ≠ signature ≠ confirmation.** `approved → ready_to_sign → submitted → confirmed` are separate states; confirmation requires receipt + finality + parameter match.
- **Parameter binding.** `paramsHash = sha256(canonical{chainId, from, to, assetType, token, amount, walletId})`. Approvals store the hash; any edit voids them.
- **Tenant isolation**: every Guard route runs under `loadWorkspace` (membership check) and every query filters by `workspace_id`. Foreign resources return 404 (no enumeration).
- **Jobs**: `JOB_MODE=inline` (dev/test, off the request path via `setImmediate`) or `queue` (BullMQ + `npm run worker`, repeatable schedulers for monitoring, webhooks, health, checkpoints, retention).

## Why `pg` + SQL migrations instead of Prisma

The spec asked for Prisma. Prisma's CLI needs a native engine binary downloaded from `binaries.prisma.sh`, which the build environment blocked; shipping an ORM layer that could not be executed or tested would have meant untested persistence code. Plain SQL migrations + `pg` are JavaScript-only, have no generated client, and were exercised by every integration test. Migrating to Prisma later is mechanical (`prisma db pull` against this schema produces the models).
