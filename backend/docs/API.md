# PoisonGuard API reference

All responses use the envelope `{ success, data | error, meta: { requestId } }`. Interactive OpenAPI UI: `GET /api/docs`.

Auth columns: **anon** = no session; **user** = Guard session cookie `pg_sid`; **cap** = workspace capability (see `src/shared/permissions.js`); **staff cap** = platform staff capability (cookie `pg_staff_sid`); **agent** = `Authorization: Bearer pgk_live_…`.

## Public (anonymous)

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/health` | anon/user |
| GET | `/api/v1/health/ready` | anon/user |
| GET | `/api/v1/chains` | anon/user |
| POST | `/api/v1/scans` | anon/user |
| POST | `/api/v1/scans/address` | anon/user |
| POST | `/api/v1/scans/transaction` | anon/user |
| GET | `/api/v1/scans/:scanId` | anon/user |
| POST | `/api/v1/scans/:scanId/rerun` | anon/user |
| POST | `/api/v1/scans/:scanId/share` | anon/user |
| GET | `/api/v1/share/:shareId` | anon/user |
| POST | `/api/v1/recipients/check` | anon/user |
| GET | `/api/v1/approvals` | anon/user |
| POST | `/api/v1/approvals/revoke-preview` | anon/user |
| POST | `/api/v1/approvals/verify` | anon/user |
| POST | `/api/v1/feedback` | anon/user |
| POST | `/api/v1/reports` | anon/user |
| POST | `/api/v1/phishing-reports` | anon/user |
| GET | `/api/v1/methodology` | anon/user |
| GET | `/api/v1/methodology/evaluations` | anon/user |
| GET | `/api/v1/content/:slug` | anon/user |

## Auth

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/auth/register` | anon |
| POST | `/api/v1/auth/login` | anon |
| POST | `/api/v1/auth/logout` | anon |
| GET | `/api/v1/auth/me` | user |
| PATCH | `/api/v1/auth/me` | user |
| POST | `/api/v1/auth/change-password` | user |
| POST | `/api/v1/auth/verify-email` | anon |
| POST | `/api/v1/auth/resend-verification` | user |
| POST | `/api/v1/auth/forgot-password` | anon |
| POST | `/api/v1/auth/reset-password` | anon |
| GET | `/api/v1/auth/sessions` | user |
| DELETE | `/api/v1/auth/sessions/:id` | user |
| POST | `/api/v1/auth/sessions/revoke-others` | user |
| POST | `/api/v1/auth/wallet/challenge` | anon |
| POST | `/api/v1/auth/wallet/verify` | anon |
| GET | `/api/v1/auth/wallets` | user |
| DELETE | `/api/v1/auth/wallets/:id` | user |

## Workspaces (root)

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/workspaces/` | user |
| POST | `/api/v1/workspaces/` | user |
| POST | `/api/v1/workspaces/invitations/accept` | user |

## Guard workspace (tenant-scoped)

Every path below is prefixed with `/api/v1/workspaces/:workspaceId` and requires an **active membership** (checked server-side on every request; non-members get 404).

| Method | Path | Capability |
|---|---|---|
| GET | `/` | workspace.view |
| PATCH | `/` | workspace.settings |
| POST | `/deletion-request` | workspace.delete |
| GET | `/overview` | workspace.view |
| GET | `/api-keys` | apikeys.manage |
| POST | `/api-keys` | apikeys.manage |
| DELETE | `/api-keys/:keyId` | apikeys.manage |
| GET | `/roles` | members.view |
| GET | `/members` | members.view |
| PATCH | `/members/:memberId` | members.manage |
| DELETE | `/members/:memberId` | members.manage |
| GET | `/invitations` | members.view |
| POST | `/invitations` | members.manage |
| DELETE | `/invitations/:invId` | members.manage |
| GET | `/access-review` | members.manage |
| GET | `/wallets` | wallets.view |
| POST | `/wallets` | wallets.manage |
| POST | `/wallets/validate` | wallets.view |
| GET | `/wallets/:walletId` | wallets.view |
| PATCH | `/wallets/:walletId` | wallets.manage |
| POST | `/wallets/:walletId/owner` | members.manage |
| GET | `/wallets/:walletId/monitoring` | wallets.view |
| PATCH | `/wallets/:walletId/monitoring` | wallets.manage |
| DELETE | `/wallets/:walletId` | wallets.manage |
| GET | `/wallets/:walletId/activity` | wallets.view |
| GET | `/wallets/:walletId/recipients` | wallets.view |
| POST | `/wallets/:walletId/scan` | scans.run |
| GET | `/recipients` | recipients.view |
| POST | `/recipients/check` | recipients.view |
| POST | `/recipients` | recipients.manage |
| GET | `/recipients/:recipientId` | recipients.view |
| PATCH | `/recipients/:recipientId` | recipients.manage |
| POST | `/recipients/:recipientId/verify` | recipients.verify |
| POST | `/recipients/:recipientId/deactivate` | recipients.manage |
| GET | `/recipients/:recipientId/history` | recipients.view |
| GET | `/scans` | scans.view |
| POST | `/scans` | scans.run |
| GET | `/scans/:scanId` | scans.view |
| POST | `/scans/:scanId/rerun` | scans.run |
| GET | `/scans/compare` | scans.view |
| GET | `/scans/:scanId/export` | scans.view |
| POST | `/scans/:scanId/share` | scans.run |
| GET | `/graph/neighbors` | scans.view |
| DELETE | `/shares/:shareId` | scans.run |
| GET | `/agents` | agents.view |
| POST | `/agents` | agents.manage |
| GET | `/agents/:agentId` | agents.view |
| POST | `/agents/:agentId/activate` | agents.manage |
| PATCH | `/agents/:agentId` | agents.manage |
| GET | `/agents/:agentId/permissions` | agents.view |
| GET | `/agents/:agentId/limits` | agents.view |
| GET | `/agents/:agentId/activity` | agents.view |
| GET | `/agents/:agentId/blocked-requests` | agents.view |
| POST | `/agents/:agentId/freeze` | agents.freeze |
| POST | `/agents/:agentId/unfreeze` | agents.manage |
| POST | `/agents/:agentId/disable` | agents.manage |
| GET | `/agents/:agentId/credentials` | agents.view |
| POST | `/agents/:agentId/credentials` | agents.manage |
| POST | `/agents/:agentId/credentials/:credId/rotate` | agents.manage |
| DELETE | `/agents/:agentId/credentials/:credId` | agents.freeze |
| GET | `/policies` | policies.view |
| POST | `/policies` | policies.edit |
| POST | `/policies/validate` | policies.view |
| POST | `/policies/simulate` | policies.view |
| GET | `/policies/:policyId` | policies.view |
| PATCH | `/policies/:policyId` | policies.edit |
| POST | `/policies/:policyId/versions` | policies.edit |
| GET | `/policies/:policyId/versions` | policies.view |
| GET | `/policies/:policyId/diff` | policies.view |
| GET | `/policies/:policyId/history` | policies.view |
| POST | `/policies/:policyId/activate` | policies.activate |
| POST | `/policies/:policyId/rollback` | policies.activate |
| POST | `/policies/:policyId/disable` | policies.activate |
| GET | `/spend-intents` | intents.view |
| POST | `/spend-intents` | intents.create |
| GET | `/spend-intents/:intentId` | intents.view |
| GET | `/spend-intents/:intentId/evaluations` | intents.view |
| PATCH | `/spend-intents/:intentId` | intents.create |
| POST | `/spend-intents/:intentId/evaluate` | intents.create |
| POST | `/spend-intents/:intentId/approve` | intents.approve |
| POST | `/spend-intents/:intentId/reject` | intents.approve |
| POST | `/spend-intents/:intentId/deny` | intents.approve |
| POST | `/spend-intents/:intentId/cancel` | intents.view |
| POST | `/spend-intents/:intentId/prepare` | intents.execute |
| POST | `/spend-intents/:intentId/submit` | intents.execute |
| POST | `/spend-intents/:intentId/reconcile` | intents.execute |
| GET | `/approvals` | intents.view |
| GET | `/audit` | membership (role-filtered) |
| GET | `/audit/:eventId` | membership (role-filtered) |
| POST | `/audit/verify` | audit.view |
| GET | `/audit/export` | audit.view |
| GET | `/proofs` | proofs.view |
| POST | `/proofs/checkpoint` | proofs.manage |
| GET | `/proofs/:proofId` | proofs.view |
| POST | `/proofs/:proofId/verify` | proofs.manage |
| POST | `/proofs/:proofId/anchor` | proofs.manage |
| GET | `/security-events` | events.view |
| GET | `/security-events/:eventId` | events.view |
| POST | `/security-events/:eventId/acknowledge` | events.manage |
| POST | `/security-events/:eventId/investigate` | events.manage |
| POST | `/security-events/:eventId/escalate` | events.manage |
| POST | `/security-events/:eventId/resolve` | events.manage |
| POST | `/security-events/:eventId/assign` | events.manage |
| POST | `/security-events/:eventId/notes` | events.manage |
| GET | `/notifications` | notifications.view |
| POST | `/notifications/:id/read` | notifications.view |
| POST | `/notifications/read-all` | notifications.view |
| GET | `/webhooks` | webhooks.manage |
| POST | `/webhooks` | webhooks.manage |
| POST | `/webhooks/:webhookId/rotate-secret` | webhooks.manage |
| PATCH | `/webhooks/:webhookId` | webhooks.manage |
| DELETE | `/webhooks/:webhookId` | webhooks.manage |
| POST | `/webhooks/:webhookId/test` | webhooks.manage |
| GET | `/webhooks/:webhookId/deliveries` | webhooks.manage |
| GET | `/knowledge` | knowledge.view |
| POST | `/knowledge` | knowledge.manage |
| GET | `/knowledge/:docId` | knowledge.view |
| PATCH | `/knowledge/:docId/access` | knowledge.manage |
| DELETE | `/knowledge/:docId` | knowledge.manage |
| POST | `/knowledge/search` | knowledge.view |
| GET | `/knowledge-retrievals` | knowledge.manage |
| POST | `/assistant/chat` | assistant.use |
| POST | `/assistant/explain-finding` | assistant.use |
| GET | `/assistant/conversations` | assistant.use |
| GET | `/assistant/conversations/:id` | assistant.use |
| GET | `/billing` | billing.view |
| POST | `/billing/checkout` | billing.manage |

## Agent machine API

| Method | Path | Tool required |
|---|---|---|
| GET | `/api/v1/agent/v1/me` | — |
| POST | `/api/v1/agent/v1/check-recipient` | check_recipient |
| POST | `/api/v1/agent/v1/scans` | scan_wallet |
| GET | `/api/v1/agent/v1/scans/:scanId` | — |
| POST | `/api/v1/agent/v1/spend-intents` | propose_transfer |
| GET | `/api/v1/agent/v1/spend-intents/:intentId` | — |

## Provider webhooks

| Method | Path | Verification |
|---|---|---|
| POST | `/api/v1/webhooks/dodo` | Standard Webhooks HMAC (`webhook-id`, `webhook-timestamp`, `webhook-signature`) |

## Platform admin

| Method | Path | Staff capability |
|---|---|---|
| POST | `/api/v1/admin/login` | none (login) |
| POST | `/api/v1/admin/logout` | none (login) |
| POST | `/api/v1/admin/logout-all` | any staff |
| GET | `/api/v1/admin/session` | any staff |
| GET | `/api/v1/admin/profile` | any staff |
| GET | `/api/v1/admin/overview` | any staff |
| GET | `/api/v1/admin/health` | any staff |
| POST | `/api/v1/admin/health/check` | any staff |
| GET | `/api/v1/admin/scans` | any staff |
| GET | `/api/v1/admin/scans/:scanId` | any staff |
| POST | `/api/v1/admin/scans/:scanId/retry` | any staff |
| POST | `/api/v1/admin/scans/:scanId/flag` | any staff |
| GET | `/api/v1/admin/findings` | any staff |
| GET | `/api/v1/admin/findings/trends` | any staff |
| POST | `/api/v1/admin/findings/:findingId/review` | any staff |
| GET | `/api/v1/admin/reports` | any staff |
| GET | `/api/v1/admin/reports/:reportId` | any staff |
| POST | `/api/v1/admin/reports/:reportId/assign` | any staff |
| POST | `/api/v1/admin/reports/:reportId/decision` | any staff |
| GET | `/api/v1/admin/workspaces` | any staff |
| GET | `/api/v1/admin/workspaces/:workspaceId` | any staff |
| POST | `/api/v1/admin/workspaces/:workspaceId/suspend` | any staff |
| POST | `/api/v1/admin/workspaces/:workspaceId/restore` | any staff |
| GET | `/api/v1/admin/users` | any staff |
| GET | `/api/v1/admin/access` | any staff |
| POST | `/api/v1/admin/access` | any staff |
| POST | `/api/v1/admin/access/:staffId/approve` | any staff |
| POST | `/api/v1/admin/access/:staffId/revoke` | any staff |
| GET | `/api/v1/admin/agents` | any staff |
| POST | `/api/v1/admin/agents/:agentId/freeze` | any staff |
| GET | `/api/v1/admin/policies` | any staff |
| GET | `/api/v1/admin/incidents` | any staff |
| GET | `/api/v1/admin/incidents/:incidentId` | any staff |
| POST | `/api/v1/admin/incidents` | any staff |
| POST | `/api/v1/admin/incidents/:incidentId/transition` | any staff |
| GET | `/api/v1/admin/audit` | any staff |
| POST | `/api/v1/admin/audit/verify` | any staff |
| GET | `/api/v1/admin/proofs` | any staff |
| POST | `/api/v1/admin/proofs/:proofId/verify` | any staff |
| GET | `/api/v1/admin/integrations` | any staff |
| PATCH | `/api/v1/admin/integrations/:id` | any staff |
| GET | `/api/v1/admin/integrations/:id/events` | any staff |
| GET | `/api/v1/admin/chains` | any staff |
| PATCH | `/api/v1/admin/chains/:chainId` | any staff |
| GET | `/api/v1/admin/billing` | any staff |
| POST | `/api/v1/admin/billing/events/:eventId/replay` | any staff |
| GET | `/api/v1/admin/content` | any staff |
| POST | `/api/v1/admin/content` | any staff |
| POST | `/api/v1/admin/content/:id/publish` | any staff |
| POST | `/api/v1/admin/evaluations` | any staff |
| POST | `/api/v1/admin/evaluations/:id/publish` | any staff |
| GET | `/api/v1/admin/feature-flags` | any staff |
| PATCH | `/api/v1/admin/feature-flags/:key` | any staff |
| GET | `/api/v1/admin/settings` | any staff |
| PATCH | `/api/v1/admin/settings/:key` | any staff |
| GET | `/api/v1/admin/notifications` | any staff |
| GET | `/api/v1/admin/ai-rag` | any staff |
| POST | `/api/v1/admin/ai-rag/documents` | ai.manage |
