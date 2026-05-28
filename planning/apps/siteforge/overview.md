# PageBolt Overview

Last updated: 2026-05-18 (UTC)

PageBolt is an AI-assisted website build workspace that helps operators connect a WordPress site, describe website intent, and launch a draft build with guarded workflow states.

## Current Planning Docs

- `planning/apps/siteforge/product-intent.md`
- `planning/apps/siteforge/command-center-foundation.md`
- `planning/apps/siteforge/architecture.md`
- `planning/apps/siteforge/builder-workflow.md`
- `planning/apps/siteforge/roadmap.md`

## Current Implementation Snapshot

- Operator entrypoint is `/pagebolt`.
- Existing workflow is a single workspace route with phase lanes: Connect, Describe, Launch.
- API and persistence behavior are already implemented under `app/api/siteforge/*` and `lib/siteforge/*`.
- This sprint introduces a command-center shell frame (sidebar + workspace) without changing PageBolt feature behavior.

## Source-of-Truth Areas

- `app/pagebolt/*`
- `app/api/siteforge/*`
- `lib/siteforge/*`
- `tests/siteforge*`
