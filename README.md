# iBrains App Repository

This repository contains the iBrains application suite and in-repo planning system used for structured delivery.

## Operating Model

Work follows a strict delivery OS:

Architect -> Builder -> GitLab Delivery -> Clean Main

The repo is no longer managed through ad-hoc chat context. Planning and sprint continuity live in this repository.

## Where To Start (Cold Entry)

Read in order:

1. `AGENTS.md`
2. `planning/state.md`
3. `planning/decisions.md`
4. `planning/risks.md`
5. `planning/questions.md`
6. app planning docs in `planning/apps/**`

## Planning Layout

Planning mirrors app structure:

- `planning/apps/ecomviper/` (Shopify, Walmart, eBay, Amazon)
- `planning/apps/studio/` (CasaFlix, Reelify, Future Studio Apps)
- `planning/apps/siteforge/`
- `planning/apps/directoryiq/`

## Authenticated Route Model

The authenticated workspace now uses standalone top-level brain routes.

- Core workspace routes: `/`, `/dashboard`, `/brains`, `/tasks`, `/reports`, `/add-brain`, `/settings`, `/billing`
- Brain workspace routes: `/ecomviper`, `/optibay`, `/optiwal`, `/optizon`, `/directoryiq`, `/casaflix`, `/pagebolt`, `/reelify`, `/ipetzo`
- `/brains` is the canonical "My Brains" index for the authenticated workspace.
- Every standalone brain console route exposes `← Back to Brains` linked to `/brains`.
- `/brains` SSR must render from canonical local brain inventory and must not block on protected runtime API calls.
- brain stats/runtime telemetry are optional post-render enrichment and must fail gracefully.
- Clerk auth for `app.ibrains.ai` uses the production instance's allowed-subdomain model under primary domain `ibrains.ai`; Clerk frontend API proxying is not part of the current route/auth contract.
- `/apps` and `/apps/*` are deprecated and removed with no compatibility redirects.
- Legacy `/studio`, `/siteforge`, and `/uapforge` routes are removed and remain `404`.

Each app should have an `overview.md` and `product-intent.md` baseline.

For major sprints, use sprint packs where appropriate:

- `requirements.md`
- `blueprint.md`
- `acceptance-criteria.md`
- `handoff-prompt.md`

## Delivery Discipline (High Level)

Every sprint is branch + MR + pipeline gated:

1. Start from clean `main`
2. Create sprint branch
3. Implement approved scope only
4. Run focused checks
5. Open MR and wait for green pipeline
6. Merge
7. Delete remote/local branch
8. Return to clean `main`

A sprint is not complete at push or MR creation.

## Development Basics

```bash
npm run dev
npm test
npm run lint
```

Open `http://localhost:3000` for local development.

## Operational Notes

- Route-signature guard: `scripts/check_route_signatures.sh`
- Release metadata endpoint: `GET /api/meta/release` (alias `GET /api/_meta/release`)
- Production deploys run on the DigitalOcean/server systemd flow from `/root/ibrains-app`; Vercel is retired and must not be a required GitHub merge check.
- Production services: `ibrains-app.service` and `fileiq-worker`; after syncing `main`, run migrations, install production dependencies, and restart both services.

Use `planning/state.md` as the continuity handoff before starting or ending any sprint.
