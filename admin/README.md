# PoisonGuard — frontend + admin (Vue 3 + Vite + Pinia + Router)
Run: `cd frontend && npm i && npm run dev` (5173); `cd admin && npm i && npm run dev` (5174). Both proxy /api to http://localhost:4000.
All data views call the real /api/v1 backend and show loading/error/empty/permission states. No mock data is shipped.
Endpoints assumed beyond the PRD list: GET /admin/session, POST /admin/login|logout, GET /approvals?owner&chainId, POST /approvals/revoke-preview|verify, GET /methodology/evaluations.
Not built/tested yet: see chat notes.
