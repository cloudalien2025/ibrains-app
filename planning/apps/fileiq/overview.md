# FileIQ Overview

Last updated: 2026-06-03 (UTC)

FileIQ is the iBrains internal file-intelligence brain at `app.ibrains.ai/fileiq`. It is an
ingestion brain: it takes supplier source files, extracts structured, provenance-tracked
facts using the Claude Agent SDK, and stores canonical data in the shared ecommerce
database for downstream commerce brains to consume.

## What FileIQ Is

- An internal-only brain (not a public/merchant surface). `/fileiq` is auth-protected.
- A source-file-to-canonical-facts pipeline with explicit provenance and validation state.
- The upstream system of record for supplier facts that EcomViper, OptiBay, OptiZon,
  OptiWal, and OptiPixel read.

## Inputs

FileIQ ingests heterogeneous supplier files:

- `PDF` (catalogs, spec sheets, COAs)
- `DOCX` (policies, descriptions)
- `XLSX` (pricing, inventory, catalogs)
- `HTML` (templates, source pages)
- images (`png`, `jpg`, label/panel scans)
- `.ai` (label artwork)
- `.tif` (high-resolution label/panel scans)

## Extraction Backbone

Extraction runs on the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`):

- Each extraction job runs as an agent session via `query()`.
- The agent is granted a bounded tool registry: file reading, web fetch, bash, and vision
  (image-capable reads).
- The agent `session_id` is captured and persisted to `fileiq_extraction_jobs.agent_session_id`
  for monitoring and retry.
- The model credential is read from the `ANTHROPIC_API_KEY` environment variable.

## Downstream Consumers

Approved canonical facts are written to the shared ecommerce database and read by:

- EcomViper (Shopify/Walmart/eBay/Amazon channels)
- OptiBay
- OptiZon
- OptiWal
- OptiPixel (image intelligence)

Downstream brains read approved facts; they do not re-extract source files.

## Relationship to Existing EcomViper Rocktomic Work

FileIQ generalizes the supplier-intelligence pipeline that EcomViper built for Rocktomic
(Firecrawl extraction, supplement-facts panels, master package builder, shared-DB import)
into a supplier-agnostic, Agent-SDK-driven ingestion brain. The provenance, validation
status, and review-gating concepts mirror the established Rocktomic contract:

- structured / partial / visual-only / missing fact statuses
- field-level provenance
- `sourceStatus`-style review gating (`needs_review` suppresses facts from downstream reads)

See `planning/apps/ecomviper/overview.md` for the Rocktomic lineage.

## Phase 1.0 Scope (FileIQ Internal Brain Foundation)

Phase 1.0 establishes the foundation only:

- Agent SDK backbone module (`lib/fileiq/agent/fileiq-agent.ts`) — options contract, tool
  registry, and an explicit-invocation extraction runner that captures the agent session id.
- UI shell at `/fileiq` matching the standard iBrains brain pattern (back-to-brains link,
  console pill, sidebar, workspace).
- Internal route protection (`/fileiq` added to the auth-protected matcher).
- Planning + type/schema contracts for the shared-DB tables (planning-only).

Phase 1.0 explicitly does **not**:

- run migrations
- perform live file parsing or OCR
- call OpenAI or Firecrawl
- change EcomViper Product Editor behavior
- add auto-save or auto-publish

## Planning Navigation

- `overview.md` (this file) — what FileIQ is and Phase 1.0 scope
- `architecture.md` — module/route architecture and the Agent SDK backbone
- `database-contract.md` — shared-DB table family and read/write contract (planning-only)
- `mvp-roadmap.md` — phased path from foundation to live ingestion
