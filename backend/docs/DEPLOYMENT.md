# Deployment

## Local (no Docker)
```bash
cd backend && cp .env.example .env    # set DATABASE_URL; leave JOB_MODE=inline
npm install
npm run db:migrate                     # also runs automatically on server start
npm run staff:create -- you@company.com "Your Name" super_admin   # prints password + TOTP secret once
npm run dev                            # http://localhost:4000, OpenAPI at /api/docs
```
Postgres needs the `vector` extension (`pgvector`). Frontend (5173) and admin (5174) Vite servers already proxy `/api` to `:4000`.

## Docker
`docker compose up --build` → pgvector Postgres, Redis, API (`JOB_MODE=queue`) and worker.

## Production checklist
- [ ] `NODE_ENV=production`, `SESSION_SECRET` (≥64 random chars), `ENCRYPTION_KEY` (`openssl rand -base64 32`), `COOKIE_SECURE=true`, `TRUST_PROXY=true` behind a proxy — the server refuses to boot without the first three.
- [ ] `CORS_ORIGINS` = exact frontend + admin origins. Serve admin on a separate origin.
- [ ] `JOB_MODE=queue` + `REDIS_URL`; run ≥1 worker (`node src/workers/index.js`).
- [ ] RPC URLs for each chain you advertise; optional `ETHERSCAN_API_KEY` for full history.
- [ ] Email provider (`EMAIL_PROVIDER=resend`), otherwise verification/reset/invite emails are not delivered.
- [ ] Dodo: products mapped, webhook registered, `billing` flag on — after sandbox testing.
- [ ] ProofRegistry deployed to a testnet → verified → mainnet; set `PROOF_REGISTRY_*` with a dedicated low-balance anchoring key.
- [ ] Backups + PITR for Postgres; audit checkpoints anchored off-box.
- [ ] Run `npm test` and (with a local node) `E2E_RPC_URL=… node --test tests/e2e/`.
