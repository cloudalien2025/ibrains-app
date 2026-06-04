# Sprint 008 Acceptance Criteria

Status: In progress
Date: 2026-05-29 (UTC)

## Functional Acceptance

1. Product editor renders AI PDP Intelligence sections with editable fields.
2. Server-side generation action returns structured PDP intelligence record.
3. Missing OpenAI configuration returns explicit unavailable state without editor failure.
4. Save action persists PDP intelligence server-side for signed-in user.
5. Reopening the same product loads saved PDP intelligence.
6. FAQ shape supports `question`, `answer`, `category`, `schema_eligible`, `compliance_status`.
7. Compliance review metadata records risk level and risky phrases.

## Security Acceptance

1. OpenAI keys are never returned in API payloads.
2. Shopify/source credentials are not exposed in client-rendered PDP intelligence fields.
3. Route access remains signed-in and user-scoped.

## Regression Acceptance

1. Sprint 006 inventory/dashboard route contract tests continue passing.
2. Sprint 007 Rocktomic supplier intelligence and route-shell tests continue passing.
3. Product editor route contract reflects AI PDP intelligence sections + placeholders.
