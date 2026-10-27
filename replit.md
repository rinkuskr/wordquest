# WordQuest

An offline-first native word-search game for Android, with progressive categories, classic and timed play, hints, and local saves.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo Router, React Native, TypeScript, AsyncStorage
- API: shared Express 5 service; health-only and optional to gameplay
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/wordquest/app/` — Home, category, mode, game, and results routes
- `artifacts/wordquest/src/engine/` — puzzle, selection, scoring, and progression rules
- `artifacts/wordquest/src/data/categories.ts` — stable category IDs/order and category word arrays
- `artifacts/wordquest/src/services/` — local save, audio, and ad abstractions
- `artifacts/api-server/` — shared health API, including `GET /health`
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `artifacts/wordquest/tests/` — deterministic game-logic tests

## Architecture decisions

- Category word arrays must match the user's exact supplied lists; do not invent or substitute words.
- Gameplay must remain offline and must not depend on the health endpoint.
- AdMob stays disabled until real IDs and a compatible native ads build are configured.

## Product

Android word-search game with 15 progressive categories, classic/time modes, gesture selection, hints, scoring, local progression, and results.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
