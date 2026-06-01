# Generate Intelligence Eval Harness (Phase 6.1)

Last updated: 2026-06-01 (UTC)

## Purpose

Provide a deterministic all-product preparation/evaluation harness for copywriting-agent contracts before live model wiring.

## CLI Scripts

- prepare: `scripts/ecomviper/copywriting_agent_prepare.ts`
- evaluate: `scripts/ecomviper/copywriting_agent_evaluate.ts`

NPM commands:

- `npm run ecomviper:copywriting-agent:prepare`
- `npm run ecomviper:copywriting-agent:evaluate`

### Prepare support

- `--all`
- `--fixtures`
- `--sku <sku>`
- `--handle <handle>`
- `--limit <n>`
- `--dry-run`

### Evaluate support

- `--all`
- `--fixtures`
- `--sku <sku>`
- `--handle <handle>`
- `--limit <n>`
- `--dry-run`

## Artifacts

When not dry-run:

- `data/ecomviper/copywriting-agent/latest/prepared-inputs.json`
- `data/ecomviper/copywriting-agent/latest/prepare-summary.json`
- `data/ecomviper/copywriting-agent/latest/eval-report.json`
- `data/ecomviper/copywriting-agent/latest/eval-summary.csv`

## Representative Fixture Set

Fixture set path:

- `data/ecomviper/copywriting-agent/fixtures/golden-products.json`

Fixtures cover representative modes (supplier-backed, Shopify-only, missing data, non-supplement) and exist only for regression scoring. They do not limit production architecture scope.

## Eval Rubric

Rubric module:

- `lib/ecomviper/copywriting-agent/copywriting-agent-evals.ts`

Scores:

- schemaValidity
- factualGrounding
- supplementCompliance
- agenticVisibility
- conversionQuality
- missingDataBehavior
- brandVoice
- sourceUseTransparency

Hard-fail conditions:

- invalid schema
- invented ingredient/dosage claims
- prohibited medical/treatment/drug-comparison claims
- fabricated COA/certification/pricing/inventory/supplier facts
- missing required missing-data notices when source facts are missing

Warnings:

- weak agentic visibility coverage
- weak conversion quality
- weak source transparency

## Phase Boundaries

Phase 6.1 eval harness remains offline/non-runtime:

- no live Product Editor behavior changes
- no live Generate Intelligence behavior changes
- no OpenAI runtime requirement
- no `OPENAI_API_KEY` requirement for tests/scripts
- no supplier imports/sync/writes/extraction/OCR

Future phases:

- Phase 6.2: wire Generate Intelligence to contract/model path
- Phase 6.3: add model-backed agentic visibility improvement loop
