# FileIQ MVP Roadmap

Last updated: 2026-06-03 (UTC)

A phased path from the Phase 1.0 foundation to live, downstream-consumed ingestion. Each
phase is scoped and reversible, and follows the standard GitLab sprint delivery flow.

## Phase 1.0 — Internal Brain Foundation (this sprint)

- Claude Agent SDK backbone (`lib/fileiq/agent/fileiq-agent.ts`): options contract, tool
  registry, explicit extraction runner capturing `agent_session_id`.
- `/fileiq` UI shell matching the standard brain pattern; internal route protection.
- Type/schema/planning contracts for the `fileiq_*` table family (planning-only).
- Foundation test coverage.

Boundaries: no migrations, no live parsing/OCR, no OpenAI/Firecrawl, no EcomViper Product
Editor change, no auto-save/publish.

## Phase 1.1 — Source Registry + Migrations

- DDL migrations for the `fileiq_*` tables in `db/migrations/`.
- `fileiq_source_bundles` / `fileiq_source_files` registration API + UI (Source Bundles,
  Suppliers, Files routes).
- Content-hash dedupe and storage-URI wiring. Still no extraction runtime.

## Phase 1.2 — Extraction Jobs (Live Agent Sessions)

- Wire `runFileIqExtractionAgent` to a job-runner API/CLI.
- Persist `agent_session_id`, status transitions, and raw extractions
  (`fileiq_extraction_jobs`, `fileiq_raw_extractions`).
- Extraction Jobs route renders live job status + session monitoring/retry.
- Begins live file parsing/vision (gated, per-bundle, explicit invocation only).

## Phase 1.3 — Canonical Normalization + Validation

- Normalize raw extractions into `fileiq_canonical_products` / `fileiq_product_facts` /
  `fileiq_product_assets` with field-level provenance.
- Validation reports (`fileiq_validation_reports`) with structured / partial / visual-only /
  missing / conflict statuses.
- Validation Reports route.

## Phase 1.4 — Review Queue + Approval Gating

- `fileiq_review_items` human review workflow (approve/reject, reason codes, assignment).
- `needs_review` gate suppresses unapproved facts from downstream reads.
- Review Queue route.

## Phase 1.5 — Published Packages + Brain Outputs

- Versioned `fileiq_published_packages` with manifest.
- Per-downstream `fileiq_brain_outputs` projections (EcomViper, OptiBay, OptiWal, OptiPixel,
  OptiZon).
- Packages + Brain Outputs routes.

## Phase 1.6 — Downstream Consumption

- Downstream brains read latest approved FileIQ facts from the shared ecommerce DB.
- Migrate EcomViper's Rocktomic supplier-facts reads onto the FileIQ canonical contract.

## Sequencing Notes

- Migrations (Phase 1.1) precede any live write.
- Live agent extraction (Phase 1.2) is always explicit-invocation and gated; never at render.
- Downstream binding (Phase 1.6) only after approval gating (Phase 1.4) is enforced.
