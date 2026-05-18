# SiteForge Product Intent

Last updated: 2026-05-18 (UTC)

This product intent is implementation-derived from current SiteForge routes, APIs, and tests.

## Product Purpose

SiteForge is an operator workspace for creating and refining website drafts from intent using guarded AI and WordPress connection workflows.

## Current Operator Workflow

1. Open `/apps/siteforge`.
2. Connect WordPress credentials and validate write capability.
3. Provide intent/brief inputs to generate planning direction.
4. Launch build pipeline and monitor progress.
5. Review resulting draft handoff state and follow-up refinement paths.

## Current Surface Model

- Connect: credentials and validation lane
- Describe: prompt-driven planning lane
- Launch: progress and draft readiness lane
- Workspace state: project, connection, Thrive detection, and run-session context

## Guardrail Posture

Current implementation enforces:

- auth-scoped workspace and project access
- explicit key and connection prerequisites for generation
- queued execution model for build/refine operations
- storage policy handling (postgres vs memory fallback constraints by environment)

## Boundaries

In scope today:

- intent-to-plan-to-build workspace behavior
- project/session/workspace persistence contracts
- WordPress and Thrive-aware integration handling

Not established as dedicated app routes yet:

- separate command-center sub-pages for each lane
- standalone operator diagnostics workspace beyond current in-page summaries

## Source-of-Truth Evidence

- `app/apps/siteforge/page.tsx`
- `app/api/siteforge/*`
- `lib/siteforge/*`
- `tests/siteforge*`

## Planning Companion Docs

- `planning/apps/siteforge/overview.md`
- `planning/apps/siteforge/command-center-foundation.md`
- `planning/apps/siteforge/architecture.md`
- `planning/apps/siteforge/builder-workflow.md`
- `planning/apps/siteforge/roadmap.md`
