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

## YouTube Watch Discovery (This Lane)

This lane adds automatic discovery + ledger population for active YouTube watches:

- supported watch kinds: `youtube_channel`, `youtube_playlist`, `youtube_keyword`
- execution path: `POST /api/brains/{id}/discover` or `scripts/run_youtube_watch_discovery.sh`
- required env: `DATABASE_URL`, `YOUTUBE_API_KEY`, and `BRAINS_MASTER_KEY` (or `BRAINS_X_API_KEY`) for route auth

Discovery behavior:

- reads active watches for the target brain
- fetches candidate YouTube videos from the watch mode
- normalizes canonical identity to YouTube `video_id`
- upserts into `brain_source_items` with watch provenance + provider payload
- dedupes by `(brain_id, source_kind='youtube_video', canonical_identity=video_id)`
- inserts `brain_ingest_runs` rows with status `discovered` only for genuinely new items
- refreshes metadata safely for rediscovered existing items

Out of scope in this lane:

- transcript/audio ingestion
- scheduling/orchestration workers
- retrieval/ranking UX

## Ingest Orchestration (This Lane)

This lane adds a minimal orchestration path that turns discovered YouTube source items into durable knowledge artifacts.

- execution path: `POST /api/brains/{id}/ingest-orchestrate` or `scripts/run_brain_ingest_orchestration.sh`
- required env:
  - `DATABASE_URL`
  - `BRAINS_MASTER_KEY` (or `BRAINS_X_API_KEY`) for route auth
  - `YOUTUBE_API_KEY` (fallback metadata path; transcript-first retrieval can still work for publicly available captions without it)
  - optional `BRAIN_INGEST_TRANSCRIPT_LANGS` (default `en,en-US`)

Lifecycle behavior:

- selects pending `brain_ingest_runs` in `discovered` / `reingest_requested`
- transitions run state: `queued` -> `processing` -> terminal (`completed` / `failed` / `skipped_duplicate`)
- fetches source-derived text from YouTube:
  - first tries timedtext transcript
  - falls back to YouTube snippet text (title + description)
- writes one `brain_documents` current transcript record per successful run
- writes `brain_chunks` linked to document/source/run/brain
- runs deterministic taxonomy enrichment for new source chunks (best effort, non-blocking)
- updates `brain_source_items.latest_ingest_run_id` and `transcript_hash`

Duplicate/reingest semantics:

- if a current transcript document already exists and run is not reingest-requested, run is marked `skipped_duplicate`
- if reingesting and content hash is unchanged, run is marked `skipped_duplicate` (`content_unchanged`)
- if reingesting and content changes, a new versioned document is created, old current doc is superseded, and lineage fields are updated

## Freshness + Versioning Contract

- `brain_documents.version_no` increments per `(source_item_id, document_kind)`.
- `brain_documents.is_current` marks the active version.
- partial unique index enforces at most one current document per source/kind.
- lineage fields (`supersedes_document_id`, `superseded_by_document_id`) capture replacement chains.
- `freshness_score` provides ranking weight for downstream retrieval/orchestration.

## Future Co-Brain Consumption

The foundation is designed so co-brains can consume normalized, taxonomy-labeled chunks with strong provenance and freshness controls. This supports expert-advisor style reasoning while keeping source traceability internal to the platform layer (instead of exposing raw robotic transcript citation behavior to end users).

## Taxonomy Enrichment (This Lane)

This lane adds deterministic chunk classification into brain taxonomy nodes.

- execution path: `POST /api/brains/{id}/taxonomy-enrich` or `scripts/run_brain_taxonomy_enrichment.sh`
- bootstrapping: taxonomy nodes are seeded/upserted per brain from a template (`foundational`, optional `directoryiq_foundational`, `ecomviper_foundational`)
- strategy: `deterministic_keyword_v1` matching taxonomy key/label/description/keywords against chunk text
- assignment write target: `brain_chunk_taxonomy_assignments`
  - `assigned_by='rule'`
  - `assignment_method='deterministic_keyword_v1'`
  - `confidence` score recorded
  - `rationale` records classifier details and provenance (`brain_id`, `source_item_id`, `ingest_run_id`, `document_id`, `chunk_id`)
- rerun behavior:
  - default run classifies only chunks without assignments
  - `force_reclassify=true` refreshes classifier-owned assignments via upsert and removes stale `rule` edges for the chunk
  - uniqueness `(chunk_id, taxonomy_node_id)` prevents duplicate assignment rows

Not implemented in this lane:

- final co-brain answer UX
- embedding/vector retrieval ranking
- broad taxonomy management UI

## Retrieval Readiness (This Lane)

This lane adds grounded retrieval over `brain_chunks` for one brain/query via:

- `POST /api/brains/{id}/retrieve`
- service: `runBrainRetrieval` (`lib/brain-learning/retrieval.ts`)

Request shape:

- `query` (required)
- `limit` (optional, default `10`, max `50`)
- `taxonomy_node_ids` (optional filter/preference list)
- `taxonomy_node_keys` (optional filter/preference list)

Ranking strategy (`deterministic_lexical_taxonomy_freshness_v1`):

- lexical relevance from deterministic token + phrase matching against chunk text/title
- taxonomy-aware weighting (strong boost when preferred taxonomy nodes match)
- freshness/currentness weighting from `brain_documents.freshness_score` + `is_current`
- deterministic tie-breakers: currentness -> version -> document recency -> chunk id

Freshness + duplication controls:

- current/fresher documents naturally outrank stale/non-current equivalents
- result diversity cap prevents flooding from one source/document (`max 2` chunks per source and per document)
- taxonomy filters (ids/keys) are applied at query time when provided

Grounded response contract includes:

- chunk/document/source/run/brain IDs
- chunk text + relevance score + score breakdown
- freshness indicators (`is_current`, `version_no`, supersede lineage)
- taxonomy matches
- provenance payload (`source_kind`, external ID, title/url/publisher, source payload, chunk metadata)

Still not in scope:

- end-user conversational co-brain UX
- embedding/vector retrieval rollout
- adaptive/learning-to-rank feedback loops

## Co-Brain Context Assembly (This Lane)

This lane adds deterministic context assembly between retrieval and future answer generation.

- endpoint: `POST /api/brains/{id}/context-assemble`
- service: `runCoBrainContextAssembly` (`lib/brain-learning/contextAssembly.ts`)
- input: `query` (required), optional `limit`, `taxonomy_node_ids`, `taxonomy_node_keys`

Output is a structured internal packet (`co_brain_context_packet_v1`) for downstream co-brains:

- query interpretation (`query_terms`, inferred intent, taxonomy preferences)
- selected top evidence set with grounding metadata
- theme synthesis from taxonomy matches
- strongest current guidance excerpts
- conflict/ambiguity signals (for example supersession tension)
- practical answering notes/guardrails for expert-style grounded responses

Assembly behavior is deterministic and freshness-aware:

- retrieval first, then context selection over ranked candidates
- suppresses duplicate text evidence and stale superseded guidance
- drops low-relevance tail evidence relative to top-scored candidates
- preserves provenance (`source_item_id`, `document_id`, `ingest_run_id`, source metadata)

Not implemented in this lane:

- final end-user co-brain conversational UX
- LLM answer generation/runtime
- adaptive reinforcement from user feedback

## Co-Brain Answer Orchestration (This Lane)

This lane adds deterministic answer orchestration over `co_brain_context_packet_v1`.

- endpoint: `POST /api/brains/{id}/answer-orchestrate`
- service: `runCoBrainAnswerOrchestration` (`lib/brain-learning/answerOrchestration.ts`)
- input: `query` (required), optional retrieval filters, optional `context_packet` override

Output contract:

- `advisor_response_v1` with:
  - direct natural answer draft (`answer`, `answer_summary`)
  - practical `recommendations`
  - `cautions` and `uncertainty_notes` when evidence is mixed
  - `next_steps`
  - grounding metadata (`supporting_context_item_ids`, freshness/conflict summary)
  - generation metadata (`deterministic_context_compose_v1`, guardrails applied)

Orchestration behavior:

- builds a context packet (or validates a provided packet) for the same `brain_id` + `query`
- prioritizes strongest current guidance and evidence-backed themes
- carries forward stale/duplicate suppression signals from context assembly
- preserves traceability by returning supporting chunk IDs in the response object

Not implemented in this lane:

- final end-user chat UX
- model-based freeform generation
- downstream app-specific rendering/integration logic
