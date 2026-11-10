# PoisonGuard Frontend Guidelines

PoisonGuard frontend application built with TanStack Start, React 19, Vite, and Tailwind CSS.

## Architecture

- **Routing**: TanStack Router file-based routing in `src/routes/`
- **State & Data**: TanStack Query (`@tanstack/react-query`) with resilient API client (`src/lib/api.ts`)
- **UI Components**: Radix UI primitives with Tailwind CSS styling
- **TypeScript**: Strict property verification (`exactOptionalPropertyTypes: true`)
