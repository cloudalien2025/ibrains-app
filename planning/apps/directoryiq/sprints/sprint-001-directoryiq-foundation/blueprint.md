# Sprint 001 Blueprint

Status: In Progress

# Sprint 001
DirectoryIQ Foundation

## Intent

Execute a narrow foundation sprint that combines planning architecture alignment with layout-shell alignment.

## Implementation Strategy

1. Inspect existing DirectoryIQ implementation and EcomViper/Walmart shell conventions.
2. Create missing DirectoryIQ planning files:
   - `architecture.md`
   - `builder.md`
   - `implementation-map.md`
   - `testing.md`
   - `roadmap.md`
3. Update `planning/apps/directoryiq/overview.md` and sprint-pack docs for alignment.
4. Implement a lightweight DirectoryIQ shell using:
   - desktop left sidebar navigation
   - right workspace content frame
   - existing mobile navigation retained
5. Add focused shell contract test coverage.

## App Change Areas

- `app/directoryiq/layout.tsx`
- `app/directoryiq/_components/directoryiq-sidebar.tsx` (new)
- existing DirectoryIQ pages remain functionally unchanged

## Test Change Areas

- `tests/directoryiq_command_center_shell.test.tsx` (new)

## Delivery And Validation Plan

1. Run focused shell and DirectoryIQ tests.
2. Run route signature guardrail script.
3. Confirm no DirectoryIQ API/lib behavior changes.
4. Complete MR/pipeline/merge/cleanup flow.

## Guardrails

- No invented requirements.
- No fake production data.
- No broad refactors.
- No non-DirectoryIQ behavior changes.
