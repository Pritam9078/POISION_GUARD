# Implementation status (what is real, what is not)

Test totals at hand-off: **60 unit/integration/security tests** (`npm test`, real Postgres+pgvector) · **4 end-to-end tests on a real EVM node** via the production ethers adapter (`tests/e2e`) · **5 Solidity tests** (`contracts`). All passing.

## Implemented and tested
- Auth: register/login/logout/me, email verification & password reset tokens, sessions list/revoke, lockout, SIWE wallet link + sign-in with replay protection.
- Workspaces, invitations, roles, last-owner protection, access review, API keys.
- Scanner: 6 deterministic rules, address + transaction scans, coverage reporting, pinned block, share cards, re-run, compare, export. Real-chain detection verified.
- Recipient checker (finding history, trusted list, sender history, context tx).
- Approvals list, revoke preview, verification by allowance re-read (real chain verified).
- Watched wallets, monitoring scheduler, trusted recipients with versioning + four-eyes verification.
- Policy engine + simulator + immutable versions + diff + simulation-gated activation + rollback.
- Spend intents: idempotency, evaluation, approval queue tabs, separation of duties, parameter binding, prepare, submit, reconciliation (confirmed / reverted / mismatch). Real-chain verified.
- Agents: registry, activation, credentials (show-once, rotate, revoke), machine API (propose only), limits, tool allowlist, freeze.
- Audit hash chains, DB append-only trigger, verification, export (JSON/CSV), checkpoints, on-chain anchoring + verification (real chain verified).
- Security events/incidents with state machine; notifications; outbound webhooks (signed, SSRF-guarded, retries).
- Knowledge base + hybrid retrieval (FTS + pgvector + RRF, similarity floor) with in-SQL access control; assistant with router, escaped prompts, multi-turn context, output guard and retention — 18-check adversarial eval (`tests/ai`), mock providers only.
- Billing: entitlements, plan limits, Dodo webhook verification/processing (locally signed events).
- Admin API for every Vue admin page + actions; separate staff auth with TOTP; two-person super-admin grants; justified cross-tenant inspection.
- Queue mode (BullMQ worker) smoke-tested end-to-end.

## Implemented, NOT tested against the real provider (no network in build env)
- Etherscan V2 indexer · TigerGraph REST++ sync/query · Anthropic/OpenAI LLM + OpenAI embeddings · Dodo checkout API (sandbox) · Resend email.

## Not implemented
- ENS resolution · NFT (721/1155) and Permit2 approvals · EIP-1271 (smart-wallet sign-in) · USD pricing / oracle (limits are base units) · PDF/DOCX document extraction · reranking model · multilingual content · WebAuthn for staff · Redis-backed rate-limit store · stored-transfer reorg rollback · threat-intel feed.

## Frontend/admin caveats found during inspection
- `frontend/` is React + TypeScript, contrary to the PRD's Vue/JS rule, and contains a duplicate React admin.
- Frontend demo fallbacks fabricate results when the API fails (recipient check, approvals, feedback); `/revoke` marks a revoke "verified" immediately after sending; `/accuracy` shows fabricated precision/recall. Remove these when wiring.
- Vue admin's workspace-detail page must send a justification (`?reason=`), which `ResourcePage.vue` does not do yet.
