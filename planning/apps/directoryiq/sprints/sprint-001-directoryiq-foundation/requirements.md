# Sprint 001 Requirements

Status: In Progress

# Sprint 001
DirectoryIQ Foundation

## Product Source Of Truth

This sprint is aligned to:

- `planning/apps/directoryiq/product-intent.md`
- `planning/apps/directoryiq/overview.md`
- `planning/state.md`

## Problem Statement

DirectoryIQ had product-intent and sprint-pack planning, but it lacked the architecture/builder foundation files and did not yet present a consistent left-sidebar/right-workspace command-center shell pattern used by EcomViper/Walmart.

## Goal

Create the missing DirectoryIQ architecture/builder planning foundation and align the existing DirectoryIQ UI into a stable workspace shell without changing DirectoryIQ functionality or API behavior.

## Sprint Focus

1. Add DirectoryIQ architecture/builder planning files grounded in existing implementation.
2. Map source-of-truth implementation paths for builders.
3. Add DirectoryIQ testing guidance for focused sprint validation.
4. Align DirectoryIQ app shell layout to left-sidebar/right-workspace pattern.
5. Preserve existing DirectoryIQ route behavior, API behavior, and data semantics.

## Functional Requirements

1. New planning docs must be implementation-derived, not speculative.
2. App shell changes must be presentation/layout only.
3. Existing DirectoryIQ content must remain available in the workspace area.
4. Sidebar links must point only to existing DirectoryIQ routes.
5. Add focused test coverage that fails when shell/sidebar landmarks are missing.

## Non-Goals

- No new backend workflows.
- No ingestion automation expansion.
- No authority scoring redesign.
- No API contract redesign.
- No schema changes.
- No cross-app behavior changes.

## Constraints

- Keep scope to DirectoryIQ planning + DirectoryIQ app shell alignment.
- Use existing design/system conventions.
- Avoid fake data and misleading capability copy.
- Follow mandatory GitLab sprint flow from `AGENTS.md`.
