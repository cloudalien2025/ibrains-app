# DirectoryIQ

DirectoryIQ is a Next.js application for managing and improving directory listing quality, with workflows for listing intelligence, authority/content support, integrations, and run tracking.

## Who This Is For

- Teams operating directory-style sites (including Brilliant Directories setups) that want operational tooling around listing quality and publishing workflows.
- Developers contributing to DirectoryIQ as a standalone public project.

## High-Level Capabilities

- DirectoryIQ listing and authority workflows under `app/(brains)/directoryiq`.
- API routes for listing, authority, integrations, and ingestion workflows under `app/api/directoryiq`.
- Integration/key handling paths for external providers (for example OpenAI/SerpAPI adapters).
- Automated test coverage with unit/integration tests (Vitest) and browser flows (Playwright).

## Local Development

### Prerequisites

- Node.js 20+ (`package.json` engines)
- npm (lockfile included)

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create a local env file (for example `.env.local`) and use placeholder values.
Do not commit real credentials.

```bash
# Required for DB-backed routes
DATABASE_URL=postgres://user:password@localhost:5432/directoryiq

# Used by API proxy helpers and runtime metadata
APP_ENV=local
APP_BASE_URL=http://127.0.0.1:3001
BRAINS_API_BASE=https://api.example.com
BRAINS_MASTER_KEY=replace_me
BRAINS_X_API_KEY=replace_me
BRAINS_WORKER_API_KEY=replace_me

# DirectoryIQ optional proxy/read-path settings
DIRECTORYIQ_API_BASE=https://directoryiq-api.example.com
NEXT_PUBLIC_DIRECTORYIQ_API_BASE=https://directoryiq-api.example.com

# Optional third-party integrations
OPENAI_API_KEY=replace_me
SERPAPI_API_KEY=replace_me

# Optional release metadata
RELEASE_GIT_SHA=replace_me
RELEASE_BUILD_TIMESTAMP=2026-01-01T00:00:00Z
```

Some features require external services and valid credentials/configuration (database, upstream APIs, provider keys).

## Validation Commands

Run the narrow checks you need while developing:

```bash
npm run lint
npm run test
npm run test:e2e:list
```

Additional project scripts are available in `scripts/` (for example `check_route_signatures.sh`).

## Repository Structure

- `app/`: Next.js App Router pages and API routes.
- `components/`: shared UI components.
- `lib/` and `src/`: shared runtime/services/utilities.
- `tests/`: Vitest and Playwright tests.
- `scripts/`: operational and verification scripts.
- `docs/`: deployment and internal process docs (some are environment-specific).

## Security

- Never commit secrets, tokens, private keys, or real customer data.
- Keep local env files out of version control (`.env*` is ignored).
- Use placeholder/example values in docs and test fixtures.

## Brilliant Directories Note

Parts of DirectoryIQ are designed for Brilliant Directories-oriented listing workflows. If you are not using that ecosystem, some routes and flows may not be applicable without adaptation.
