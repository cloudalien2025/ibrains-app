# PageBolt Architecture

Last updated: 2026-05-18 (UTC)

## Purpose

Document current PageBolt architecture from repository implementation evidence.

## Runtime Entry Points

App route:

- `/pagebolt` via `app/pagebolt/page.tsx`

App shell:

- `app/pagebolt/layout.tsx`
- `app/pagebolt/_components/siteforge-sidebar.tsx`
- `lib/siteforge/siteforge-nav.ts`

## Current UI Architecture

Current implementation is a single-page command workspace client with phase-based operator flow:

- Connect phase: credentials and connection validation
- Describe phase: intent prompt and direction planning
- Launch phase: build execution state, progress, and draft handoff

State management and UI guards are handled in `page.tsx` with helper contracts exported for targeted tests.

## API Surface

Primary route families under `app/api/siteforge`:

- projects: list/create (`projects/route.ts`)
- project workspace read/update (`projects/[projectId]/route.ts`)
- project connection validate/save/revalidate (`projects/[projectId]/connection/route.ts`)
- build enqueue (`projects/[projectId]/build/route.ts`)
- AI config save/update/remove (`projects/[projectId]/ai/route.ts`)
- refinement enqueue (`projects/[projectId]/refine/route.ts`)
- session read (`sessions/[sessionId]/route.ts`)
- admin summary (`admin/summary/route.ts`)
- standalone connection validation (`connection/validate/route.ts`)

## Domain/Service Layers

PageBolt core libraries provide:

- project/workspace shape normalization (`workspaceShape.ts`)
- repository contracts and persistence policy (`repository/*`)
- orchestrator + runner job dispatch (`orchestrator.ts`, `runner.ts`)
- WordPress connection and Thrive-aware build orchestration (`wordpress/*`, `thrive*`)
- AI/planning/content/build agents (`agents/*`)

## Command-Center Shell Boundary

This sprint’s shell boundary is visual/structural only:

- adds persistent sidebar and workspace frame
- does not alter current phase logic or API contracts
- keeps existing operator content inside right workspace

## Current Implementation Status

Built/current:

- authenticated project/workspace lifecycle
- connection validation + stored profile flow
- AI key save/remove flow
- queued build and refinement execution paths
- progress and launch-state UX in single workspace route

Partial/placeholder:

- no dedicated multi-route command-center sub-pages yet
- lane navigation is organized in-page rather than route-separated

Deferred:

- route-level decomposition into dedicated command-center sections
- deeper operator diagnostics and governance surfaces

## Source-of-Truth Files

- `app/pagebolt/page.tsx`
- `app/pagebolt/layout.tsx`
- `app/pagebolt/_components/siteforge-sidebar.tsx`
- `lib/siteforge/siteforge-nav.ts`
- `app/api/siteforge/*`
- `lib/siteforge/*`
- `tests/siteforge*`
