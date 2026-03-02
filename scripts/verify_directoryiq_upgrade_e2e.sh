#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${E2E_APP_PORT:-3002}"
HOST="${E2E_APP_HOST:-127.0.0.1}"
BASE_URL="http://${HOST}:${PORT}"
PROJECT="${PW_PROJECT:-chromium}"
SPEC="${PW_SPEC:-tests/e2e/directoryiq-upgrade-flow.spec.ts}"
SERVER_LOG="${E2E_SERVER_LOG:-/tmp/directoryiq-upgrade-e2e-server.log}"
START_TIMEOUT_SECS="${E2E_START_TIMEOUT_SECS:-90}"

if ss -ltn "( sport = :${PORT} )" | grep -q ":${PORT}"; then
  echo "FAIL: port ${PORT} is already in use."
  echo "Set E2E_APP_PORT to a free port and retry."
  exit 1
fi

cd "${ROOT_DIR}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting mock-enabled Next dev server at ${BASE_URL}"
NODE_TLS_REJECT_UNAUTHORIZED=0 E2E_MOCK_OPENAI=1 E2E_MOCK_BD=1 \
  npm run dev -- --port "${PORT}" --hostname "${HOST}" >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

echo "Waiting for ${BASE_URL}/api/health (timeout: ${START_TIMEOUT_SECS}s)"
for ((i = 1; i <= START_TIMEOUT_SECS; i++)); do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    echo "Server is ready."
    break
  fi
  if ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    echo "FAIL: server exited before becoming ready. Log: ${SERVER_LOG}"
    tail -n 80 "${SERVER_LOG}" || true
    exit 1
  fi
  sleep 1
  if [[ "${i}" -eq "${START_TIMEOUT_SECS}" ]]; then
    echo "FAIL: timed out waiting for server readiness. Log: ${SERVER_LOG}"
    tail -n 80 "${SERVER_LOG}" || true
    exit 1
  fi
done

echo "Running Playwright: ${SPEC} (${PROJECT})"
UI_AUDIT_BASE_URL="${BASE_URL}" E2E_MOCK_OPENAI=1 E2E_MOCK_BD=1 \
  npx playwright test "${SPEC}" --project="${PROJECT}"

echo "PASS: DirectoryIQ upgrade e2e verification completed."
