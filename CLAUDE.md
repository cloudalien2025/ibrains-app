# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operating Model

This repo follows a strict delivery OS: **Architect → Builder → GitLab MR → Clean Main**. Before touching any code, read in order:

1. `AGENTS.md` — builder execution contract and sprint flow
2. `planning/state.md` — current sprint status and recommended next sprint
3. `planning/decisions.md` — accepted architectural decisions (do not contradict)
4. `planning/risks.md` and `planning/questions.md`
5. Relevant app planning docs under `planning/apps/**`

Planning is the source of truth. Never invent requirements; derive intent from code and planning docs.

## Commands

```bash
# Development
pnpm dev                    # Next.js dev server
pnpm build                  # Production build
pnpm lint                   # ESLint

# Unit tests (Vitest)
pnpm test                   # Run all unit tests
pnpm test:watch             # Watch mode
npx vitest run tests/ecomviper_shopify_connection.test.ts  # Run a single test file

# E2E tests (Playwright)
pnpm test:e2e               # All E2E (pass-with-no-tests)
pnpm test:e2e:ci            # CI E2E via scripts/pw_ci.sh

# Database
pnpm ecommerce:migrate      # Run DB migrations
pnpm ecommerce:check-db     # Verify DB connection

# EcomViper supplier ops
pnpm ecomviper:import-rocktomic-supplier-package
pnpm ecomviper:build-rocktomic-supplier-data
pnpm ecomviper:rocktomic:supplier-intelligence
pnpm ecomviper:live-supplier-facts:parity

# Sprint delivery
pnpm pr:automerge <PR_NUMBER>   # Squash-merge green PR and delete branch
```

## Sprint Delivery Flow (Mandatory)

Every sprint: clean `main` → branch → implement approved scope → tests → commit → push → MR → wait for green pipeline → merge → delete remote branch → delete local branch → `git switch main && git pull` → verify clean → update `planning/state.md`.

A sprint is **not complete** until `planning/state.md` is updated with MR number, pipeline result, merge SHA, and branch cleanup status.

Commit message format: `fix(area): desc` / `feat(area): desc` / `chore(area): desc` / `ops(area): desc`

Branch naming: `feat/<area>-<desc>`, `fix/<area>-<desc>`, `chore/<area>-<desc>`, `sprint-###-short-description`

## Architecture

### Next.js App Router Layout

```
app/
  layout.tsx             # Root layout — sets release ID, StaleClientRecovery
  (shell)/               # Authenticated workspace (Clerk auth guard in layout.tsx)
    layout.tsx           # force-dynamic; redirects to /sign-in if no userId
    dashboard/, brains/, tasks/, reports/, settings/, billing/, runs/
  (brains)/              # Brain layout wrapper
  ecomviper/             # EcomViper hub + Shopify product editor
  optibay/, optiwal/, optizon/, directoryiq/, casaflix/, pagebolt/, reelify/, ipetzo/
  admin/                 # Internal admin console (require-admin guard)
  api/                   # Route handlers — never use page components here
  sign-in/, sign-up/
```

### Lib Layer (`lib/`)

Business logic lives entirely in `lib/`. Never import from `app/` in `lib/`.

Key namespaces:
- `lib/auth/` — Clerk auth helpers; `requireSignedInUser()` is the standard API route guard
- `lib/ecomviper/` — largest domain; subdivided:
  - `shopify/` — Shopify client, workspace hydration, product editor, PDP intelligence, publish workflow
  - `walmart/` — Walmart client, docket hydration, AI optimizer, compliance, scoring
  - `ebay/` — eBay inventory/scoring providers
  - `suppliers/` — Rocktomic supplier intelligence; `firecrawl/` and `rocktomic/` subdirs hold PDF extraction, supplement facts panel parser, OpenAI vision fallback
  - `copywriting-agent/` — all-product AI copywriting contract (prompt, runner, evals, input builder)
  - `core/` — cross-channel marketplace types, draft workflow, product normalizer
- `lib/brains/` — brain catalog, views, createBrain, missionControl
- `lib/siteforge/` — SiteForge/PageBolt orchestration, Thrive intelligence
- `lib/studio/` — CasaFlix/Domara studio engines
- `lib/directoryiq/` — DirectoryIQ authority, SERP, blog drafts
- `lib/runtime/` — `clientRecovery.ts` (stale client guard)

### Auth Pattern

**API routes**: call `requireSignedInUser()` from `lib/auth/requireSignedInUser.ts`. It handles Clerk middleware context errors, session cookie fallback, and returns `{ userId, unauthorizedResponse }`. If `unauthorizedResponse` is non-null, return it immediately.

**Shell layout**: SSR redirect via `auth()` from `@clerk/nextjs/server`. `(shell)/layout.tsx` redirects to `/sign-in` if no userId.

**Admin routes**: `lib/require-admin.ts` wraps `requireSignedInUser` with role check.

**E2E bypass**: `process.env.E2E_MOCK_GRAPH === "1"` returns `userId = "e2e-admin"` everywhere.

### Database

PostgreSQL via `pg`. Migrations live in `db/migrations/` (timestamped SQL files). Each domain area imports `pg` directly — there is no shared ORM. Run migrations with `pnpm ecommerce:migrate`.

### Import Aliases

`@` resolves to the project root. Standard usage: `@/lib/...`, `@/app/...`, `@/components/...`, `@/types/...`. In tests, `server-only` is mocked via `tests/__mocks__/server-only.ts`.

### Testing Conventions

- Unit tests: `tests/**/*.test.{ts,tsx}` (Vitest, `environment: "node"`)
- E2E: `tests/e2e/` (Playwright, excluded from Vitest)
- Test files are named after the module they cover: `ecomviper_shopify_connection.test.ts` tests `lib/ecomviper/shopify/shopify-connection.ts`
- Tests use `tests/__mocks__/` for `server-only` and other server modules

### Key Architectural Boundaries

- **No Product Editor auto-save/auto-publish** without explicit user action
- **No model calls during page render** — AI calls happen only in API routes or CLI scripts
- **No DB writes during page render** — imports/migrations are CLI-only
- Supplier intelligence extraction (Rocktomic) is offline/CLI-first; results are cached; the live route reads cached facts
- `sourceStatus` field gates whether supplier facts surface to the Product Editor (`needs_review` = suppressed)

### Planning Hierarchy

```
planning/
  state.md          # Current sprint status — update after every sprint close
  decisions.md      # Accepted decisions (D-001…) — never contradict without new decision
  risks.md          # Active risk register
  apps/
    ecomviper/shopify/, walmart/, ebay/, amazon/
    studio/casaflix/, uap-forge/
    siteforge/
    directoryiq/
```

For major sprints, use a four-file sprint pack: `requirements.md`, `blueprint.md`, `acceptance-criteria.md`, `handoff-prompt.md`.
