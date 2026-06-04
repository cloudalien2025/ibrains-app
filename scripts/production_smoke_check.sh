#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-app.ibrains.ai}}"
PROTO="${PROTO:-https}"
BASE_URL="${BASE_URL:-${PROTO}://${DOMAIN}}"
HOST_HEADER="${HOST_HEADER:-}"
MAX_TIME="${MAX_TIME:-10}"
SERVICE_NAME="${SERVICE_NAME:-ibrains-app}"
RUN_DETAILED_SMOKE="${RUN_DETAILED_SMOKE:-1}"
TAIL_LINES="${TAIL_LINES:-120}"

failures=0

note() { printf '%s\n' "$*"; }
pass() { printf 'PASS: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; failures=$((failures + 1)); }

curl_host_args=()
if [ -n "${HOST_HEADER}" ]; then
  curl_host_args=(-H "Host: ${HOST_HEADER}")
fi

systemctl_cmd=(systemctl)
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  systemctl_cmd=(sudo systemctl)
fi

check_service_status() {
  if "${systemctl_cmd[@]}" is-active --quiet "${SERVICE_NAME}"; then
    pass "service ${SERVICE_NAME} is active"
  else
    fail "service ${SERVICE_NAME} is not active"
  fi
}

check_route_timing() {
  local path="$1"
  local expected_regex="$2"
  local name="$3"
  local out
  out=$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' --max-time "${MAX_TIME}" "${curl_host_args[@]}" "${BASE_URL}${path}" || true)
  local code time_total
  code=$(printf '%s' "${out}" | awk '{print $1}')
  time_total=$(printf '%s' "${out}" | awk '{print $2}')
  note "${name}: code=${code:-missing} time_total=${time_total:-missing}s"
  if printf '%s' "${code}" | grep -Eq "${expected_regex}"; then
    pass "${name} returned acceptable status ${code}"
  else
    fail "${name} returned unexpected status ${code:-missing}"
  fi
}

check_release_metadata_non_null() {
  local body
  body=$(curl -sS --max-time "${MAX_TIME}" "${curl_host_args[@]}" "${BASE_URL}/api/meta/release" || true)
  if [ -z "${body}" ]; then
    fail "release metadata response is empty"
    return
  fi

  if python3 - "${body}" <<'PY'
import json
import sys

try:
    data = json.loads(sys.argv[1])
except Exception:
    sys.exit(1)

for field in ("git_sha", "build_id"):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip() or value == "unavailable":
        sys.exit(2)

if "deployed_at" in data and data.get("deployed_at") is not None and not str(data.get("deployed_at")).strip():
    sys.exit(3)
PY
  then
    pass "release metadata git_sha/build_id are non-null"
  else
    fail "release metadata git_sha/build_id are missing or unavailable"
    note "release metadata body: ${body}"
  fi
}

check_close_wait_count() {
  if ! command -v ss >/dev/null 2>&1; then
    note "ss not available; skipping CLOSE-WAIT check"
    return
  fi
  local count
  count=$(ss -tan state close-wait | tail -n +2 | wc -l | tr -d ' ')
  note "close-wait sockets: ${count}"
  if [ "${count}" -gt 400 ]; then
    fail "close-wait socket count is elevated (${count})"
  else
    pass "close-wait socket count is within safety threshold (${count})"
  fi
}

run_log_tails() {
  note "recent app log tail:"
  tail -n "${TAIL_LINES}" /var/log/ibrains-app/app.log 2>/dev/null || note "app log unavailable"

  note "recent nginx error tail:"
  tail -n "${TAIL_LINES}" /var/log/nginx/error.log 2>/dev/null || note "nginx generic error log unavailable"
  tail -n "${TAIL_LINES}" /var/log/nginx/app.ibrains.ai.error.log 2>/dev/null || note "nginx app error log unavailable"

  note "recent systemd journal tail:"
  journalctl -u "${SERVICE_NAME}" -n "${TAIL_LINES}" --no-pager 2>/dev/null || note "journalctl unavailable"
}

main() {
  note "production smoke check target: ${BASE_URL}"
  check_service_status
  check_close_wait_count

  check_route_timing "/api/health" '^200$' "/api/health"
  check_route_timing "/api/meta/release" '^200$' "/api/meta/release"
  check_release_metadata_non_null
  check_route_timing "/brains" '^(200|307)$' "/brains"
  check_route_timing "/ecomviper" '^(200|307)$' "/ecomviper"
  check_route_timing "/ecomviper/settings" '^(200|307)$' "/ecomviper/settings"
  check_route_timing "/ecomviper/dropshipping/rocktomic" '^(200|307)$' "/ecomviper/dropshipping/rocktomic"

  if [ "${RUN_DETAILED_SMOKE}" = "1" ]; then
    if bash "$(dirname "$0")/prod_smoke.sh" "${DOMAIN}"; then
      pass "prod_smoke.sh checks passed"
    else
      fail "prod_smoke.sh checks failed"
    fi
  fi

  run_log_tails

  if [ "${failures}" -gt 0 ]; then
    note "production smoke check completed with ${failures} failure(s)"
    exit 1
  fi
  note "production smoke check passed"
}

main "$@"
