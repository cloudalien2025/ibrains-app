# FileIQ Architecture

Last updated: 2026-06-03 (UTC)

## Route Surface

```
app/fileiq/
  layout.tsx                         # force-dynamic; back-to-brains link + console pill + sidebar grid
  page.tsx                           # Command Center; renders workspace shell
  _components/
    fileiq-sidebar.tsx               # nav from lib/fileiq/fileiq-nav (active-path aware)
    fileiq-page-header.tsx           # command-center header ("Internal only")
    fileiq-workspace-shell.tsx       # composes header + dashboard cards + pipeline/agent/downstream panels
    fileiq-dashboard-cards.tsx       # foundation metric cards (zeroed in Phase 1.0)
```

`/fileiq` follows the same brain-console shape as OptiBay (`app/optibay/layout.tsx`):
`max-w-[1320px]` main, back-to-brains link, a console pill, and a
`236px / minmax(0,1fr)` sidebar+content grid.

## Lib Layer

```
lib/fileiq/
  fileiq-nav.ts        # ordered nav items (Command Center … Settings)
  fileiq-status.ts     # status enums + type guards (extraction job / validation / review / downstream brain)
  fileiq-types.ts      # domain interfaces (bundles, files, jobs, canonical products, facts, assets, reports, reviews, packages, outputs)
  fileiq-schema.ts     # planned shared-DB table list + database boundary contract (planning-only)
  agent/
    fileiq-agent.ts    # Claude Agent SDK backbone (server-only)
```

`lib/` never imports from `app/`. The UI shell imports pure contracts from `lib/fileiq`
(`fileiq-nav`, `fileiq-status`, `fileiq-schema`) but never imports the Agent SDK backbone,
so the SDK never enters a route bundle.

## Agent SDK Backbone (`lib/fileiq/agent/fileiq-agent.ts`)

The backbone is the server-only seam between a FileIQ extraction job and the Claude Agent
SDK. It is marked `import "server-only"` and is never imported by any render path.

Exports:

- `ClaudeAgentOptions` — alias of the SDK `Options` type.
- `FILEIQ_AGENT_API_KEY_ENV` = `"ANTHROPIC_API_KEY"` — the only credential source.
- `FILEIQ_AGENT_DEFAULT_MODEL` = `"claude-opus-4-8"`.
- `FILEIQ_AGENT_TOOLS` — logical capability → SDK tool name map
  (`fileReading→Read`, `webFetch→WebFetch`, `bash→Bash`, `vision→Read`).
- `FILEIQ_AGENT_ALLOWED_TOOLS` — deduped allow-list (`Read`, `WebFetch`, `Bash`).
- `buildFileIqAgentOptions(input)` — **pure** options builder (model, system prompt, allowed
  tools, bounded turns, `settingSources: []`); safe to unit test and call outside runtime.
- `resolveFileIqAgentApiKey()` — returns the key or `null` when unset/blank.
- `runFileIqExtractionAgent(input)` — **explicit-invocation** session runner.

### Extraction Session Flow

1. A caller (future CLI/API route) invokes `runFileIqExtractionAgent({ jobId, bundleId, prompt, … })`.
2. If `ANTHROPIC_API_KEY` is absent → returns `status: "unavailable"`
   (`agent_credentials_missing`) — safe degradation, no throw, mirrors EcomViper's
   `generation_unavailable` pattern.
3. Otherwise it builds options and drives `query({ prompt, options })`.
4. The first streamed message yields the agent `session_id`; it is captured immediately so a
   caller can persist it for monitoring/retry even on later failure.
5. The terminal `result` message resolves into a stable `FileIqAgentRunResult`:
   - `success` → `status: "completed"` with `resultText`, `numTurns`, `totalCostUsd`.
   - `error_*` → `status: "failed"` with the SDK subtype as `errorCode`.
   - stream-without-result → `status: "failed"` (`agent_no_result`).
   - thrown error → `status: "failed"` (`agent_session_error`).

`agentSessionId` is the value persisted to `fileiq_extraction_jobs.agent_session_id`.

## Auth / Internal Boundary

FileIQ is internal-only. `/fileiq(.*)` is added to the auth-protected matcher in `proxy.ts`
(alongside `/ecomviper`, `/optibay`, `/optizon`, …). Unauthenticated requests to `/fileiq`
redirect to `/sign-in` with the `redirect_url` preserved
(`tests/proxy_apps_auth_protection.test.ts`).

## Render-Time Safety Boundaries (Phase 1.0)

- No agent session is started from page render or module import.
- No model call, DB write, migration, OCR, or live file parse occurs in the render path.
- The dashboard cards are static foundation placeholders (zeroed).

## Testing

`tests/fileiq_foundation.test.ts` (Vitest, node env):

- nav contract (10 ordered destinations under `/fileiq`)
- status type guards
- shared-DB boundary (planning-only, `ECOMMERCE_DATABASE_URL`, downstream brains)
- agent option contract (default model, deduped tool allow-list, overrides)
- agent runner (unavailable-without-key, session-id capture, success/error/no-result mapping)

The Agent SDK is mocked in the test (`vi.mock("@anthropic-ai/claude-agent-sdk")`) so the real
CLI-spawning runtime never loads.
