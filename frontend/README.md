# 🛡️ PoisonGuard Frontend

The official web client for [PoisonGuard](https://github.com/Pritam9078/POISION_GUARD). Built with **TanStack Start**, **React 19**, **Tailwind CSS**, and **Vite 8**.

---

## ⚡ Features

- **Interactive Risk Scanner**: Multi-chain real-time address poisoning and dust attack inspector.
- **Guard Workspace**: Enterprise and team workspace for policy configuration, counterparty management, and transaction approval state machines.
- **Token Allowance Auditor (`/revoke`)**: Self-custody read-only token allowance inspector and zero-allowance transaction generator.
- **Autonomous Agent Dashboard**: Guardrail monitors and cryptographic intent verification for AI agents.

---

## 🛠️ Tech Stack

- **Framework**: TanStack Start (SSR & Static generation)
- **UI Library**: React 19
- **Bundler**: Vite 8
- **Styling**: Tailwind CSS with custom glassmorphism and aurora themes
- **Icons**: Lucide React
- **Web3**: Direct EIP-1193 provider integration (MetaMask, Coinbase Wallet, WalletConnect)

---

## 🚀 Development Setup

```bash
# Install dependencies
npm install

# Start local development server (port 5173)
npm run dev

# Run TypeScript typecheck
npx tsc --noEmit

# Build production bundle
npm run build
```

---

## 🌐 Environment Variables

Create a `.env` file in the `frontend` root:

```env
# Optional: override default backend API base (defaults to /api/v1 with direct Render fallback)
VITE_API_BASE=https://poisonguard-backend.onrender.com/api/v1
```
