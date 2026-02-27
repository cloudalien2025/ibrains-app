# SSC v1 Ferrari: Wiring and Operations

## Purpose

This module provides:
- Prompt-pack loading and active-pack selection (`DB_PROMPTS`, `EB_PROMPTS_EcomViper`, `VISUAL_PROMPTS`)
- Hash-locked scoring responses with strict validator checks
- Visual storyboard scoring for entity URLs (or uploaded screenshots)

## Prerequisites

- `DATABASE_URL` configured and reachable
- `OPENAI_API_KEY` configured
- SSC artifacts present in `ssc_artifacts/incoming/`
- Optional storage env:
  - `SSC_STORAGE_MODE=local` (default)
  - `SSC_STORAGE_DIR` (default `/tmp/ssc`)

## DB Migration

```bash
psql "$DATABASE_URL" -f migrations/20260227_ssc_v1.sql
```

## API Endpoints

- `GET /api/ssc/prompt-packs`
  - Loads prompt packs on first call and returns active/available packs.
- `GET /api/ssc/prompt-packs/:packName`
  - Returns metadata for one pack.
- `POST /api/ssc/eval`
  - Scores one DB/EB dimension using snapshot text.
- `POST /api/ssc/storyboard/run`
  - Captures screenshot + visible text via Playwright, then scores visual dimensions.
- `POST /api/ssc/storyboard/upload`
  - Scores a provided base64 screenshot + visible text (Playwright fallback).
- `GET /api/ssc/storyboard/latest?entity_type=...&entity_id=...`
  - Returns latest storyboard run and score payloads.
- `GET /api/ssc/storyboard/asset?key=...`
  - Returns stored storyboard image assets.

## UI Wiring

- Dashboard: `/ssc`
  - Shows active prompt packs and links to entity hub.
- Entity hub: `/ssc/entities/<entity_type>/<entity_id>`
  - `Storyboard` tab: run capture via URL.
  - `Upload` tab: submit image + visible text when Playwright is unavailable.
  - `Notes` tab: usage notes.

## Quick Checks

```bash
npm test
npx tsc --noEmit
npm run build
```

For Playwright capture support:

```bash
npx playwright install --with-deps
```

## Troubleshooting

- `SSC_PLAYWRIGHT_MISSING`
  - Install Playwright or use `/api/ssc/storyboard/upload`.
- `SSC_VALIDATION_FAILED`
  - Model output violated schema/rules; inspect `rule_failed` and `details`.
- `Prompt not found for <pack>:<dimension>`
  - Pack not loaded/active or dimension key mismatch.
