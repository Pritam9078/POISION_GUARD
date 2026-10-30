# PoisonGuard backend

Fastify 5 · Node 22 · JavaScript (ESM) · PostgreSQL 16 + pgvector · optional Redis/BullMQ · ethers v6 · Solidity (proof registry only).

Serves the public scanner, the Guard workspace, the agent machine API and the platform-admin API from one codebase with separate auth planes. Built against the existing `frontend/` and `admin/` apps — see `docs/FRONTEND_INTEGRATION_MAP.md` and `docs/ADMIN_INTEGRATION_MAP.md`.

```bash
cp .env.example .env          # set DATABASE_URL (Postgres with pgvector)
npm install
npm run dev                   # migrates + seeds reference data, listens on :4000, OpenAPI at /api/docs
npm run staff:create -- you@company.com "Your Name" super_admin   # first admin (prints password + TOTP once)
npm run db:seed               # optional dev-only demo account
```

Add at least one RPC (`ETHEREUM_RPC_URL`, `SEPOLIA_RPC_URL`, …) — chains without RPC report `offline` and scans on them fail as *inconclusive* rather than returning fake data.

## Tests
```bash
createdb poisonguard_test            # with CREATE EXTENSION vector available
npm test                             # 60 unit + integration + security tests (resets poisonguard_test)
(cd contracts && npm i && npx hardhat test)                     # ProofRegistry (HARDHAT_LOCAL_SOLC=1 offline)
(cd contracts && npx hardhat node) & E2E_RPC_URL=http://127.0.0.1:8545 node --test tests/e2e/   # real-EVM e2e
```
`TEST_DATABASE_URL` overrides the test database.

## Non-negotiables enforced in code
Non-custodial (no keys, no signing, no broadcasting) · deterministic rules and policy engine (AI never decides) · approval ≠ signature ≠ confirmation · approvals bound to exact parameters · tenant isolation on every query · no "safe" verdicts from incomplete data · no fabricated accuracy numbers · hash-chained, append-only audit.

## Docs
`docs/STATUS.md` (what is real / untested / missing) · `ARCHITECTURE.md` · `API.md` · `SECURITY.md` · `BLOCKCHAIN.md` · `WALLET_INTEGRATION.md` · `AI_RAG.md` · `TIGERGRAPH.md` · `DODO_PAYMENTS.md` · `DEPLOYMENT.md`
