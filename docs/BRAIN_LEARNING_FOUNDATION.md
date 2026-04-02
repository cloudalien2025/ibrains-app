# Brain Learning Foundation

This repository now includes a minimal Postgres-first foundation for continuously learning brains (for example `directoryiq` and `ecomviper`) without rebuilding ingestion runtime logic in-app.

## Entities

- `brains`: durable brain registry + type/config.
- `brain_source_watches`: monitored discovery targets (channels, playlists, keywords, domains, feeds).
- `brain_source_items`: global source ledger per brain with canonical dedupe identity.
- `brain_ingest_runs`: each ingest attempt lifecycle (`discovered` -> terminal state), including reingest lineage.
- `brain_documents`: normalized knowledge artifacts per ingest run with document version/freshness semantics.
- `brain_chunks`: chunked knowledge units preserving provenance to document/source/run.
- `brain_taxonomy_nodes`: taxonomy tree per brain.
- `brain_chunk_taxonomy_assignments`: confidence-scored chunk classification edges.

## Dedupe Contract

Duplicate ingestion prevention is based on:

- source-level uniqueness in `brain_source_items` via `(brain_id, source_kind, canonical_identity)`.
- ingest-attempt sequencing in `brain_ingest_runs` via `(source_item_id, attempt_no)`.

Canonical identities should use provider-native stable IDs where possible (for example YouTube video ID).

## Freshness + Versioning Contract

- `brain_documents.version_no` increments per `(source_item_id, document_kind)`.
- `brain_documents.is_current` marks the active version.
- partial unique index enforces at most one current document per source/kind.
- lineage fields (`supersedes_document_id`, `superseded_by_document_id`) capture replacement chains.
- `freshness_score` provides ranking weight for downstream retrieval/orchestration.

## Future Co-Brain Consumption

The foundation is designed so co-brains can consume normalized, taxonomy-labeled chunks with strong provenance and freshness controls. This supports expert-advisor style reasoning while keeping source traceability internal to the platform layer (instead of exposing raw robotic transcript citation behavior to end users).
