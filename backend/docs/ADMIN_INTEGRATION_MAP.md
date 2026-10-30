# Admin integration map (Vue `admin/`)

Inspected: `admin/src/router/index.js`, `stores/session.js`, `services/api.js`, `components/ResourcePage.vue`, `views/Login.vue`. The Vue admin is a generic shell: every page renders `ResourcePage` against one endpoint and tabulates `data.items` (or `data` as one row). The backend implements **exactly those endpoints**, so the app works as-is. Action endpoints (POST/PATCH below) need buttons/forms added to the Vue views.

Vite dev proxy: `/api → http://localhost:4000` ✔. Cookies: `pg_staff_sid` (httpOnly, SameSite=Lax), 8 h TTL. CSRF: state-changing requests must come from an allowed `Origin` (`ADMIN_URL`).

## Session (`stores/session.js`)

| Store call | Endpoint | Notes |
|---|---|---|
| `load()` | `GET /admin/session` | `{ staff: { id, email, name, role, capabilities[], scopes[] }, securityNotice }` — `s.can(cap)` works unchanged. |
| `login(email, password, otp)` | `POST /admin/login` | TOTP is **mandatory** for staff (`403 MFA_SETUP_REQUIRED` if not enrolled). Lockout after 5 failures (`423`). |
| `logout()` | `POST /admin/logout` | Also `POST /admin/logout-all`. |

A Guard user session never authenticates here (separate table, cookie and capability set).

## Pages (router `pages[]` → endpoint)

| Admin route | `meta.endpoint` (GET) | Staff capability | Actions to wire |
|---|---|---|---|
| `/overview` | `/admin/overview` | platform.view | `?days=` |
| `/system/health` | `/admin/health` | integrations.view | `POST /admin/health/check` (integrations.manage) |
| `/scans` | `/admin/scans` | scans.view | `GET /admin/scans/:id`; `POST /admin/scans/:id/retry` (creates a **new** scan); `POST /admin/scans/:id/flag {reason}` |
| `/findings` | `/admin/findings?tab=open\|reviewed\|false_positive\|reported` | findings.review | `GET /admin/findings/trends`; `POST /admin/findings/:id/review {decision: valid\|false_positive\|insufficient_evidence\|duplicate, notes, supportingTx?, escalation?, regressionCandidate}` |
| `/reports` | `/admin/reports?status=` | reports.review | `GET /admin/reports/:id` (contact email unmasked only for reviewer roles, access audited); `POST …/assign {staffId?}`; `POST …/decision {decision: needs_info\|resolved\|rejected\|duplicate, notes, findingDecision?, regressionCandidate}` |
| `/workspaces` | `/admin/workspaces` | workspaces.view | `POST /admin/workspaces/:id/suspend {reason}` / `restore` (workspaces.suspend) |
| `/workspaces/:workspaceId` | `/admin/workspaces/:workspaceId` | **workspaces.inspect** | **Requires `?reason=` or `X-Justification` header** (≥5 chars). `ResourcePage` must append it — currently it does not, so this page returns 400 until a justification prompt is added. Logged to the platform chain **and** the customer's audit trail. Returns masked metadata only. |
| `/access` | `/admin/access` | access.manage | `POST /admin/access {email,name,role,accessExpiresAt,justification,temporaryPassword}` → returns TOTP secret once; `super_admin` grants are `pending_approval` until `POST /admin/access/:id/approve` by **another** super admin; `POST /admin/access/:id/revoke {reason}` |
| `/agents` | `/admin/agents` | agents.view | `POST /admin/agents/:id/freeze {incidentId, reason}` — requires an **open incident**; also revokes credentials |
| `/policies` | `/admin/policies` | policies.view | Detection rule versions + tenant policy counts (tenant policies are read-only to staff) |
| `/spend-incidents` | `/admin/incidents?type=spend` | incidents.view | `GET /admin/incidents/:id` (includes intent snapshot) |
| `/security-incidents` | `/admin/incidents?type=security` | incidents.view | `POST /admin/incidents {...}`; `POST /admin/incidents/:id/transition {to, note, assignToMe}` |
| `/audit` | `/admin/audit` (platform chain; `?workspaceId=` to inspect a tenant chain — audited) | audit.view | `POST /admin/audit/verify {chainKey, fromSeq, toSeq}` — failure opens a critical incident |
| `/proofs` | `/admin/proofs` | proofs.view | `POST /admin/proofs/:id/verify` |
| `/integrations` | `/admin/integrations` | integrations.view | `PATCH /admin/integrations/:id {enabled, timeoutMs, reason}`; `GET …/:id/events`. Only `keyConfigured` booleans are returned — never secret values. |
| `/chains` | `/admin/chains` | chains.view | `PATCH /admin/chains/:chainId {enabled, confirmations, capabilities, reason}` — capabilities can only be **narrowed** |
| `/billing` | `/admin/billing` | billing.view | `POST /admin/billing/events/:id/replay` (re-processes a stored, verified event idempotently) |
| `/content` | `/admin/content` | content.view | `POST /admin/content` (draft) → `POST /admin/content/:id/publish` (**different staff member** than author); `POST /admin/evaluations` (record run: raw TP/FP/TN/FN) → `POST /admin/evaluations/:id/publish` |
| `/feature-flags` | `/admin/feature-flags` | flags.view | `PATCH /admin/feature-flags/:key {enabled, rolloutScope: none\|staff\|all\|workspaces:<ids>, expiresAt, changeReason}` |
| `/settings` | `/admin/settings` | settings.view | `PATCH /admin/settings/:key {value, reason}` — keys resembling secrets are refused |

Extra endpoints with no Vue page yet: `GET /admin/users` (users.view), `GET /admin/notifications` (webhook delivery failures), `GET /admin/ai-rag` + `POST /admin/ai-rag/documents` (platform methodology corpus), `GET /admin/profile`.

## Not provided — by design

No endpoint lets staff approve/reject a spend intent, sign or broadcast, edit a tenant policy, impersonate a user, or read secrets. Emergency controls (suspend workspace, freeze agent) are justified and written to both audit chains.

## Staff roles (defaults, `platform_staff_roles`)

`super_admin` (all), `security_reviewer` (scans, findings, reports, incidents, agent freeze, audit, proofs), `support` (reports, workspaces list, users, incidents read), `operations` (integrations, chains, flags, settings), `billing_ops` (billing). Provision the first account with `npm run staff:create -- email "Name" super_admin`.
