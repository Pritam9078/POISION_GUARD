# Security model

| Control | Implementation | Test |
|---|---|---|
| Passwords | scrypt N=2^15, per-user salt; generic login errors; lockout after 5 fails (15 min users / 30 min staff); dummy hash against timing enumeration | unit + security |
| Sessions | 256-bit random tokens, stored as HMAC(SESSION_SECRET), httpOnly SameSite=Lax cookies, `Secure` enforced in production; list/revoke; password reset revokes all | integration |
| CSRF | Cookie auth + Origin allowlist on every state-changing request | security |
| Staff | Separate table/cookie/capabilities; **mandatory TOTP**; super-admin grants need a second super admin; access expiry; all actions on platform audit chain | security |
| Tenant isolation | `loadWorkspace` membership check on every Guard route; workspace-scoped SQL; foreign resources → 404 | security |
| Authorization | Capability matrix (`shared/permissions.js`) enforced server-side; UI hiding is cosmetic | security |
| Separation of duties | No self-approval; agent owners can't approve their agent's spend (unless policy opts in); distinct approvers (unique constraint); four-eyes trusted-recipient verification; content publish ≠ author | integration |
| Approval binding | `paramsHash` stored on approvals; edits void them; prepare re-checks | integration + security |
| Agents | Keyed-hash credentials shown once; tool allowlist; chain/wallet allowlists; mandatory explicit per-asset limits; freeze cancels pending; agents only *propose* | integration |
| Wallet auth | SIWE message, 10-min expiry, single-use nonce claimed atomically; signer must match | integration |
| Webhooks in | Standard Webhooks HMAC over raw body, timestamp tolerance, idempotency | integration |
| Webhooks out | HMAC-SHA256 `t=…,v1=…`, event id for dedupe, https-only, DNS-resolved private-IP block (SSRF), no redirects, backoff, secrets AES-256-GCM at rest | unit + security |
| Audit | SHA-256 hash chain per workspace + platform; DB trigger blocks UPDATE/DELETE; verification reports exact range and first broken link; failure opens a critical incident | integration (tamper test) |
| Input | zod on every body/query; checksum validation for mixed-case addresses; 256 KB body limit (2 MB for KB docs); invalid JSON → 400 | security |
| Errors | Envelope with code + request id; no stack traces | security |
| Rate limits | Global 300/min/IP; scans 12/min; reports 5/10 min; auth 10/min; staff login 5/min | — |
| Secrets | Env only; admin APIs return `keyConfigured` booleans; settings refuse secret-like keys | — |
| Privacy | IPs stored only as salted hash, purged after 30 days; report contact emails purged after 180 days; contact view by staff is audited | — |

**Never**: store seed phrases/private keys, sign user transactions, trust client risk scores/payment status/agent claims, let AI influence policy.

Known gaps: no EIP-1271; no WebAuthn for staff; rate limiting is per-process (use Redis store for multi-instance); no automated dependency audit in CI yet; `npm audit` reports advisories in dev tooling (Hardhat) only.
