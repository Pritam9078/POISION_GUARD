# PoisonGuard — Frontend Build Roadmap

Scope (user request): complete **frontend only**, end to end, for **user** (public site + Guard workspace) and **admin** (platform admin). Built on this project's TanStack Start stack with clearly-labeled demo fixtures (no backend in this phase). Design: light soft-gradient fintech style (aurora gradient, floating rounded cards, pill controls, oversized light headline).

- [x] Foundation: theme tokens (soft gradient light), fonts, root head, demo auth store, fixture data layer
- [x] Shared component library (layouts, PageHeader, DataTable, badges, states, AddressDisplay, etc.)
- [x] Public website: Home with scanner, /scan/:scanId (+tabs), /check-recipient, /revoke, /methodology, /accuracy, /recovery, /anti-phishing, /privacy, /terms, /report, /share/:shareId
- [x] Guard auth pages: login, register, forgot-password, reset-password, workspaces
- [x] Guard workspace: overview, wallets (+detail +monitoring/activity/recipients), recipients, scans, agents (+register +detail +permissions/limits/credentials/activity/blocked-requests), spend-intents (+new +detail +policy-evaluation/approvals/execution/reconciliation), approvals, policies (+new +detail +versions/history/simulator/activation), team (+invite/member/roles/invitations/access-review), knowledge (+add/detail/access/sources/retrieval-history), audit, proofs, security-events, notifications, billing, settings
- [x] Admin: login, overview, system/health, scans, findings, reports, workspaces, workspaces/:id, access, agents, policies, spend-incidents, security-incidents, audit, proofs, integrations, chains, billing, content, feature-flags, settings
- [x] Demo session gating for /guard and /admin with clearly labeled demo mode
- [x] Verification: build, typecheck, browser walkthrough (public → guard → admin)

Notes:
- All data comes from `src/lib/fixtures.ts` and is labeled "Demo data" in the UI — backend integration is a later phase.
- Auth is a frontend demo session only; real enforcement must be server-side in a later phase.
