#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-app.ibrains.ai}}"
PROTO="${PROTO:-https}"
BASE_URL="${BASE_URL:-${PROTO}://${DOMAIN}}"
HOST_HEADER="${HOST_HEADER:-}"

curl_host_args=()
if [ -n "${HOST_HEADER}" ]; then
  curl_host_args=(-H "Host: ${HOST_HEADER}")
fi

failures=0

note() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; failures=$((failures+1)); }
pass() { printf 'PASS: %s\n' "$*"; }

systemctl_cmd=(systemctl)
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  systemctl_cmd=(sudo systemctl)
fi

check_service() {
  local svc="$1"
  if "${systemctl_cmd[@]}" is-active --quiet "$svc"; then
    pass "service ${svc} is active"
  else
    fail "service ${svc} is NOT active"
  fi
}

check_http_status() {
  local url="$1"
  local name="$2"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" "${curl_host_args[@]}" "$url" || true)
  if [ "$code" = "200" ]; then
    pass "${name} returned 200"
  else
    fail "${name} returned ${code}"
  fi
}

check_health_json() {
  local url="$1"
  local body
  body=$(curl -sS "${curl_host_args[@]}" "$url" || true)
  if [ -z "$body" ]; then
    fail "health check empty response"
    return
  fi

  python3 - "$body" <<'PY' > /tmp/health_parse.txt 2>/dev/null || true
import json,sys
try:
    data=json.loads(sys.argv[1])
except Exception:
    print('BADJSON')
    sys.exit(2)

ok = data.get('ok') is True
upstream_ok = data.get('upstream_ok') is True
print('OK' if ok else 'NOK')
print('UPSTREAM_OK' if upstream_ok else 'UPSTREAM_BAD')
PY

  if grep -q '^OK$' /tmp/health_parse.txt; then
    pass "health ok=true"
  else
    fail "health ok not true"
  fi

  if grep -q '^UPSTREAM_OK$' /tmp/health_parse.txt; then
    pass "health upstream_ok=true"
  else
    fail "health upstream_ok not true"
  fi
}

note "Domain: ${DOMAIN}"
note "Base URL: ${BASE_URL}"
if [ -n "${HOST_HEADER}" ]; then
  note "Host header: ${HOST_HEADER}"
fi

check_service ibrains-app
check_service nginx

check_http_status "${BASE_URL}/" "/"
check_health_json "${BASE_URL}/api/health"

if [ "$failures" -eq 0 ]; then
  note "PASS: all checks succeeded"
  exit 0
else
  note "FAIL: ${failures} check(s) failed"
  exit 1
fi
