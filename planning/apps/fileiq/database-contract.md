# FileIQ Database Contract (Planning-Only)

Last updated: 2026-06-03 (UTC)

> **Migration state: `planning_only`.** Phase 1.0 defines the table family and read/write
> contract as types/planning only. No migrations run, and no data is imported or written in
> this phase. The canonical machine-readable boundary is
> `lib/fileiq/fileiq-schema.ts` (`fileIqDatabaseBoundary`).

## Connection Boundary

- Target database: shared ecommerce Postgres (`ibrains-ecommerce-prod-postgres`).
- Connection env var: `ECOMMERCE_DATABASE_URL` only (never `DATABASE_URL`).
- Aligns with the existing EcomViper "Shared Ecommerce Database Foundation" boundary.

## Table Family (`fileiq_*`)

All FileIQ-owned tables are prefixed `fileiq_`. The planned set
(`fileIqPlannedTables` in `lib/fileiq/fileiq-schema.ts`):

| Table | Purpose |
|---|---|
| `fileiq_source_bundles` | A supplier's registered set of source files. |
| `fileiq_source_files` | Individual files in a bundle (type, role, storage URI, content hash). |
| `fileiq_extraction_jobs` | One extraction run per bundle/file; **carries `agent_session_id`**. |
| `fileiq_raw_extractions` | Raw per-job artifacts (pre-normalization) with source-file linkage. |
| `fileiq_canonical_products` | Normalized product identity (canonical SKU/name) per supplier. |
| `fileiq_product_facts` | Structured facts with provenance, validation status, confidence, review status. |
| `fileiq_product_assets` | Product assets (labels, panels, images) with format/role/provenance. |
| `fileiq_validation_reports` | Per-bundle/job validation summaries and status. |
| `fileiq_review_items` | Human review queue items (fact/asset, reason code, assignment). |
| `fileiq_published_packages` | Versioned, published canonical packages with manifest. |
| `fileiq_brain_outputs` | Per-downstream-brain output projections keyed by supplier/SKU/version. |

## `fileiq_extraction_jobs` (Agent Session Tracking)

The extraction-jobs table is the monitoring/retry anchor for Agent SDK sessions. Planned
columns (derived from `FileIqExtractionJob` in `lib/fileiq/fileiq-types.ts`):

| Column | Type (planned) | Notes |
|---|---|---|
| `id` | text/uuid PK | Job id. |
| `bundle_id` | text/uuid FK → `fileiq_source_bundles` | |
| `status` | text | `pending` / `running` / `completed` / `failed` / `cancelled`. |
| `extractor_type` | text | Extractor strategy identifier. |
| `agent_session_id` | text NULL | Claude Agent SDK `session_id`; set as soon as the session starts. |
| `started_at` | timestamptz NULL | |
| `completed_at` | timestamptz NULL | |
| `error_code` | text NULL | Stable failure code (e.g. `agent_credentials_missing`, `error_max_turns`). |
| `error_message` | text NULL | |
| `summary` | jsonb | Job summary payload. |

`agent_session_id` is populated from `FileIqAgentRunResult.agentSessionId` returned by
`runFileIqExtractionAgent` (see `architecture.md`).

## Provenance

Every fact/asset carries a provenance reference (`FileIqProvenanceRef`): source file, page /
sheet / row / column / link, extraction method, confidence, validation status, review status,
and capture time. This mirrors the field-level provenance model proven in the EcomViper
Rocktomic master package.

## Read Contract (Downstream Brains)

`fileIqDatabaseBoundary.readContract`:

- Downstream brains read **latest approved facts** keyed by `supplier`, `sku`, `product`,
  and `channel`.
- Reads include provenance (`includeProvenance: true`).
- Reads include validation status (`includeValidationStatus: true`).
- Review-gated facts (`needs_review`) are suppressed from downstream reads, mirroring the
  EcomViper `sourceStatus` gate.

Downstream brains: `ecomviper`, `optibay`, `optiwal`, `optipixel`, `optizon`.

## Write Contract

- FileIQ is the only writer of `fileiq_*` tables.
- Writes happen exclusively through offline/CLI/API extraction-and-publish flows — never
  during page render.
- Phase 1.0 performs no writes (planning-only).

## Out of Scope (Phase 1.0)

- DDL migrations (deferred to the migration phase in `mvp-roadmap.md`).
- Any import of supplier data into the shared ecommerce DB.
- Binding any downstream brain to live `fileiq_*` reads.
