#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-app.ibrains.ai}}"
PROTO="${PROTO:-https}"
BASE_URL="${BASE_URL:-${PROTO}://${DOMAIN}}"
HOST_HEADER="${HOST_HEADER:-}"
EXPECT_RELEASE_FILE="${EXPECT_RELEASE_FILE:-0}"
EXPECT_BUILD_ID="${EXPECT_BUILD_ID:-}"
EXPECT_GIT_SHA="${EXPECT_GIT_SHA:-}"
SMOKE_PATHS="${SMOKE_PATHS:-/ /sign-in}"

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

check_frontdoor_assets() {
  local html_url="$1"
  local route_name="$2"
  local html_file
  local refs_file
  html_file="$(mktemp)"
  refs_file="$(mktemp)"
  trap 'rm -f "$html_file" "$refs_file"' RETURN

  if ! curl -sS "${curl_host_args[@]}" "$html_url" -o "$html_file"; then
    fail "${route_name} HTML fetch failed"
    return
  fi

  if command -v rg >/dev/null 2>&1; then
    rg -o '/_next/static/[^" )]+' "$html_file" | sed 's/\\$//' | sort -u > "$refs_file" || true
  else
    grep -Eo '/_next/static/[^" )]+' "$html_file" | sed 's/\\$//' | sort -u > "$refs_file" || true
  fi
  local ref_count
  ref_count=$(wc -l < "$refs_file" | tr -d ' ')
  if [ "${ref_count}" -eq 0 ]; then
    fail "${route_name} HTML has no _next/static asset refs"
    return
  fi
  pass "${route_name} HTML exposes ${ref_count} _next/static asset refs"

  local path
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" "${curl_host_args[@]}" "${BASE_URL}${path}" || true)
    if [ "$code" = "200" ]; then
      pass "${route_name} asset ${path} returned 200"
    else
      fail "${route_name} asset ${path} returned ${code}"
    fi
  done < "$refs_file"
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

check_release_meta() {
  local url="$1"
  local body
  body=$(curl -sS "${curl_host_args[@]}" "$url" || true)
  if [ -z "$body" ]; then
    fail "release meta empty response"
    return
  fi

  python3 - "$body" <<'PY' > /tmp/release_meta_parse.txt 2>/dev/null || true
import json,sys
try:
    data=json.loads(sys.argv[1])
except Exception:
    print('BADJSON')
    sys.exit(2)

print('RELEASE_FILE_TRUE' if data.get('release_file') is True else 'RELEASE_FILE_FALSE')
print(f"BUILD_ID={data.get('build_id') or ''}")
print(f"GIT_SHA={data.get('git_sha') or ''}")
PY

  if grep -q '^BADJSON$' /tmp/release_meta_parse.txt; then
    fail "release meta invalid JSON"
    return
  fi

  if [ "${EXPECT_RELEASE_FILE}" = "1" ]; then
    if grep -q '^RELEASE_FILE_TRUE$' /tmp/release_meta_parse.txt; then
      pass "release meta preserved release.json"
    else
      fail "release meta missing release.json"
    fi
  fi

  if [ -n "${EXPECT_BUILD_ID}" ]; then
    if grep -q "^BUILD_ID=${EXPECT_BUILD_ID}$" /tmp/release_meta_parse.txt; then
      pass "release build_id matches ${EXPECT_BUILD_ID}"
    else
      fail "release build_id mismatch"
    fi
  fi

  if [ -n "${EXPECT_GIT_SHA}" ]; then
    if grep -q "^GIT_SHA=${EXPECT_GIT_SHA}$" /tmp/release_meta_parse.txt; then
      pass "release git_sha matches ${EXPECT_GIT_SHA}"
    else
      fail "release git_sha mismatch"
    fi
  fi
}

note "Domain: ${DOMAIN}"
note "Base URL: ${BASE_URL}"
if [ -n "${HOST_HEADER}" ]; then
  note "Host header: ${HOST_HEADER}"
fi

check_service ibrains-app
check_service nginx

for route_path in ${SMOKE_PATHS}; do
  check_http_status "${BASE_URL}${route_path}" "${route_path}"
  check_frontdoor_assets "${BASE_URL}${route_path}" "${route_path}"
done

check_health_json "${BASE_URL}/api/health"
check_release_meta "${BASE_URL}/api/meta/release"

if [ "$failures" -eq 0 ]; then
  note "PASS: all checks succeeded"
  exit 0
else
  note "FAIL: ${failures} check(s) failed"
  exit 1
fi
