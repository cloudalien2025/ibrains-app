# DirectoryIQ Testing Guide

Last updated: 2026-05-18 (UTC)

## Purpose

Define the focused validation baseline for DirectoryIQ sprint work.

## Focused Commands

### 1) Route signature guard

Run for any route/component sprint touching app or API handlers:

`bash scripts/check_route_signatures.sh`

### 2) DirectoryIQ test suite slice

Run for all DirectoryIQ-scoped changes:

`npm test -- --run tests/directoryiq*`

### 3) Shared regression slice (only when required)

Run when shared shell/layout/framework behavior is touched:

`npm test -- --run tests/apps_layout_auth_contract.test.tsx tests/frontdoor_layout_chain_contract.test.ts`

Run EcomViper/Walmart regression only when shared components overlap those surfaces.

## Validation Expectations

- Prefer targeted tests first.
- Keep sprint checks proportional to changed files.
- Do not skip tests silently; if unavailable in environment, document command and failure reason in MR.

## Typical Evidence to Include in MR

- exact commands run
- pass/fail outcome
- any command unavailable notes
- explicit statement when no API behavior was changed

## Test Ownership Guidance

- New tests should assert observable contracts (layout shell, route behavior, guardrail semantics).
- Avoid brittle tests tied to incidental class names unless those class names are explicit contracts.
- For shell work, assert presence of navigation and workspace landmarks.
