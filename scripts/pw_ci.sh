#!/usr/bin/env bash
set -euo pipefail

export CI=1
export E2E_MOCK_GRAPH=1
export NODE_ENV=test
export NEXT_TELEMETRY_DISABLED=1

pnpm test:e2e
