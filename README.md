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
- `planning/apps/studio/` (CasaFlix, UAP Forge, Future Studio Apps)
- `planning/apps/siteforge/`
- `planning/apps/directoryiq/`

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

Use `planning/state.md` as the continuity handoff before starting or ending any sprint.
