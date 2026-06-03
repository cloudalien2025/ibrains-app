#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-app.ibrains.ai}}"
PROTO="${PROTO:-https}"
BASE_URL="${BASE_URL:-${PROTO}://${DOMAIN}}"
HOST_HEADER="${HOST_HEADER:-}"
EXPECT_RELEASE_FILE="${EXPECT_RELEASE_FILE:-0}"
EXPECT_BUILD_ID="${EXPECT_BUILD_ID:-}"
EXPECT_GIT_SHA="${EXPECT_GIT_SHA:-}"
PUBLIC_SMOKE_PATHS="${PUBLIC_SMOKE_PATHS:-/ /sign-in}"
PROTECTED_REDIRECT_PATHS="${PROTECTED_REDIRECT_PATHS:-/dashboard /optiwal/connect}"
LEGACY_NOT_FOUND_PATHS="${LEGACY_NOT_FOUND_PATHS:-/apps /apps/studio /studio /siteforge /uapforge}"
SKIP_SERVICE_CHECKS="${SKIP_SERVICE_CHECKS:-0}"
# Retry budget for SHA/build_id comparison checks.  The service restart after a
# deploy creates a timing window where /api/meta/release still reflects the
# previous build.  We poll until the expected values appear or retries are
# exhausted.  6 attempts × 10 s = up to 60 s total — well within any reasonable
# deploy restart window.
RELEASE_SHA_POLL_RETRIES="${RELEASE_SHA_POLL_RETRIES:-6}"
RELEASE_SHA_POLL_INTERVAL="${RELEASE_SHA_POLL_INTERVAL:-10}"

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
    local headers_file
    local code
    local content_type
    headers_file="$(mktemp)"
    if ! curl -sS -D "$headers_file" -o /dev/null "${curl_host_args[@]}" "${BASE_URL}${path}"; then
      fail "${route_name} asset ${path} request failed"
      rm -f "$headers_file"
      continue
    fi
    code=$(awk '/^HTTP/{code=$2} END{print code}' "$headers_file")
    content_type=$(awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{print $2}' "$headers_file" | tr -d '\r' | tail -n 1)
    if [ "$code" = "200" ]; then
      pass "${route_name} asset ${path} returned 200"
    else
      fail "${route_name} asset ${path} returned ${code}"
      rm -f "$headers_file"
      continue
    fi

    case "$path" in
      *.js)
        case "$content_type" in
          application/javascript*|text/javascript*)
            pass "${route_name} asset ${path} served javascript content-type"
            ;;
          *)
            fail "${route_name} asset ${path} unexpected content-type ${content_type:-missing}"
            ;;
        esac
        ;;
      *.css)
        case "$content_type" in
          text/css*)
            pass "${route_name} asset ${path} served css content-type"
            ;;
          *)
            fail "${route_name} asset ${path} unexpected content-type ${content_type:-missing}"
            ;;
        esac
        ;;
    esac

    rm -f "$headers_file"
  done < "$refs_file"
}

normalize_route_path() {
  local route_path="$1"
  if [ "$route_path" != "/" ]; then
    route_path="${route_path%/}"
  fi
  printf '%s' "$route_path"
}

check_protected_redirect() {
  local route_path="$1"
  local url="$2"
  local headers_file
  local code
  local location
  local validation
  headers_file="$(mktemp)"
  trap 'rm -f "$headers_file"' RETURN

  if ! curl -sS -D "$headers_file" -o /dev/null "${curl_host_args[@]}" "$url"; then
    fail "${route_path} protected route request failed"
    return
  fi

  code=$(awk '/^HTTP/{code=$2} END{print code}' "$headers_file")
  location=$(awk 'BEGIN{IGNORECASE=1} /^Location:/{sub(/\r$/,"",$0); print substr($0,10)}' "$headers_file" | tail -n 1 | sed 's/^[[:space:]]*//')

  if [ "$code" != "307" ]; then
    fail "${route_path} expected 307 protected redirect, got ${code:-missing}"
    return
  fi

  if [ -z "$location" ]; then
    fail "${route_path} protected redirect missing Location header"
    return
  fi

  if printf '%s' "$location" | grep -qi 'localhost:3001'; then
    fail "${route_path} protected redirect Location must not include localhost:3001"
    return
  fi

  if ! validation=$(
    python3 - "$location" "$DOMAIN" "$route_path" <<'PY'
import sys
from urllib.parse import parse_qs, urlparse

location, domain, expected_path = sys.argv[1], sys.argv[2], sys.argv[3]
expected = expected_path.rstrip("/") or "/"
parsed = urlparse(location)

if parsed.scheme not in ("http", "https"):
    print("Location must be absolute http/https URL", end="")
    sys.exit(1)
if parsed.hostname != domain:
    print(f"Location host must be {domain}", end="")
    sys.exit(1)
if parsed.path != "/sign-in":
    print("Location path must be /sign-in", end="")
    sys.exit(1)

redirect_values = parse_qs(parsed.query, keep_blank_values=True).get("redirect_url", [])
if not redirect_values or not redirect_values[0]:
    print("redirect_url query param missing", end="")
    sys.exit(1)

redirect_url = redirect_values[0]
if "localhost:3001" in redirect_url.lower():
    print("redirect_url must not include localhost:3001", end="")
    sys.exit(1)

redirect_parsed = urlparse(redirect_url)
if redirect_parsed.scheme in ("http", "https"):
    if redirect_parsed.hostname != domain:
        print(f"redirect_url host must be {domain}", end="")
        sys.exit(1)
    redirect_path = redirect_parsed.path or "/"
elif redirect_url.startswith("/"):
    redirect_path = redirect_url
else:
    print("redirect_url must be absolute app URL or absolute path", end="")
    sys.exit(1)

normalized_redirect_path = redirect_path.rstrip("/") or "/"
if normalized_redirect_path != expected:
    print(f"redirect_url path must match {expected_path}", end="")
    sys.exit(1)

print("ok", end="")
PY
  ); then
    fail "${route_path} protected redirect invalid: ${validation}"
    return
  fi

  pass "${route_path} returned expected 307 protected redirect"
}

check_not_found() {
  local route_path="$1"
  local url="$2"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" "${curl_host_args[@]}" "$url" || true)
  if [ "$code" = "404" ]; then
    pass "${route_path} returned 404 as expected"
  else
    fail "${route_path} expected 404, got ${code:-missing}"
  fi
}

check_health_json() {
  local url="$1"
  local body_file
  local status_code
  local body
  body_file="$(mktemp)"
  trap 'rm -f "$body_file"' RETURN
  status_code=$(curl -sS -o "$body_file" -w "%{http_code}" "${curl_host_args[@]}" "$url" || true)
  body=$(cat "$body_file" 2>/dev/null || true)
  if [ -z "$body" ]; then
    fail "health check empty response"
    note "health http status: ${status_code:-missing}"
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
print(f"OK={'true' if ok else 'false'}")
print(f"UPSTREAM_OK={'true' if upstream_ok else 'false'}")
print(f"APP_OK={data.get('app_ok')!r}")
print(f"DEPLOY_READY={data.get('deploy_ready')!r}")
print(f"STATUS={data.get('status')!r}")
print(f"UPSTREAM_ERROR={data.get('upstream_error')!r}")
PY

  if grep -q '^BADJSON$' /tmp/health_parse.txt; then
    fail "health check invalid JSON"
    note "health http status: ${status_code:-missing}"
    note "health body: ${body}"
    return
  fi

  if grep -q '^OK=true$' /tmp/health_parse.txt; then
    pass "health ok=true"
  else
    fail "health ok not true"
  fi

  if grep -q '^UPSTREAM_OK=true$' /tmp/health_parse.txt; then
    pass "health upstream_ok=true"
  else
    fail "health upstream_ok not true"
  fi

  if ! grep -q '^OK=true$' /tmp/health_parse.txt || ! grep -q '^UPSTREAM_OK=true$' /tmp/health_parse.txt; then
    note "health http status: ${status_code:-missing}"
    note "health body: ${body}"
    note "health parsed: $(tr '\n' ';' < /tmp/health_parse.txt | sed 's/;$/\\n/')"
  fi
}

# Fetches /api/meta/release and parses it into /tmp/release_meta_parse.txt.
# Returns 1 (without writing the file) if the response body is empty so callers
# can treat a brief restart-window gap as a retryable condition.
_fetch_release_meta_parse() {
  local url="$1"
  local body
  body=$(curl -sS "${curl_host_args[@]}" "$url" || true)
  if [ -z "$body" ]; then
    return 1
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
print(f"DEPLOYED_AT={data.get('deployed_at') or data.get('build_timestamp') or ''}")
PY
  return 0
}

check_release_meta() {
  local url="$1"

  if ! _fetch_release_meta_parse "$url"; then
    fail "release meta empty response"
    return
  fi

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

  if grep -q '^BUILD_ID=$' /tmp/release_meta_parse.txt || grep -q '^BUILD_ID=unavailable$' /tmp/release_meta_parse.txt; then
    fail "release build_id is missing or unavailable"
  else
    pass "release build_id is non-null"
  fi

  if grep -q '^GIT_SHA=$' /tmp/release_meta_parse.txt || grep -q '^GIT_SHA=unavailable$' /tmp/release_meta_parse.txt; then
    fail "release git_sha is missing or unavailable"
  else
    pass "release git_sha is non-null"
  fi

  # SHA/build_id comparison: retry with backoff to absorb the deploy restart
  # timing window.  The service may still be serving the previous build when the
  # smoke test first fires — we poll until the expected values appear or the
  # retry budget is exhausted.
  if [ -n "${EXPECT_BUILD_ID}" ] || [ -n "${EXPECT_GIT_SHA}" ]; then
    local attempt=1
    while true; do
      local sha_ok=1
      if [ -n "${EXPECT_BUILD_ID}" ] && ! grep -q "^BUILD_ID=${EXPECT_BUILD_ID}$" /tmp/release_meta_parse.txt 2>/dev/null; then
        sha_ok=0
      fi
      if [ -n "${EXPECT_GIT_SHA}" ] && ! grep -q "^GIT_SHA=${EXPECT_GIT_SHA}$" /tmp/release_meta_parse.txt 2>/dev/null; then
        sha_ok=0
      fi

      if [ "${sha_ok}" -eq 1 ]; then
        [ -n "${EXPECT_BUILD_ID}" ] && pass "release build_id matches ${EXPECT_BUILD_ID}"
        [ -n "${EXPECT_GIT_SHA}" ] && pass "release git_sha matches ${EXPECT_GIT_SHA}"
        return
      fi

      if [ "${attempt}" -ge "${RELEASE_SHA_POLL_RETRIES}" ]; then
        local actual_build_id actual_sha
        actual_build_id=$(grep '^BUILD_ID=' /tmp/release_meta_parse.txt 2>/dev/null | cut -d= -f2- || true)
        actual_sha=$(grep '^GIT_SHA=' /tmp/release_meta_parse.txt 2>/dev/null | cut -d= -f2- || true)
        if [ -n "${EXPECT_BUILD_ID}" ] && [ "${actual_build_id}" != "${EXPECT_BUILD_ID}" ]; then
          fail "release build_id mismatch after ${attempt} poll attempt(s): expected=${EXPECT_BUILD_ID} actual=${actual_build_id:-missing}"
        fi
        if [ -n "${EXPECT_GIT_SHA}" ] && [ "${actual_sha}" != "${EXPECT_GIT_SHA}" ]; then
          fail "release git_sha mismatch after ${attempt} poll attempt(s): expected=${EXPECT_GIT_SHA} actual=${actual_sha:-missing}"
        fi
        return
      fi

      note "release SHA not yet updated (attempt ${attempt}/${RELEASE_SHA_POLL_RETRIES}), waiting ${RELEASE_SHA_POLL_INTERVAL}s..."
      sleep "${RELEASE_SHA_POLL_INTERVAL}"
      attempt=$((attempt + 1))
      _fetch_release_meta_parse "$url" || true
    done
  fi
}

note "Domain: ${DOMAIN}"
note "Base URL: ${BASE_URL}"
if [ -n "${HOST_HEADER}" ]; then
  note "Host header: ${HOST_HEADER}"
fi

if [ "${SKIP_SERVICE_CHECKS}" != "1" ]; then
  check_service ibrains-app
  check_service nginx
fi

for route_path in ${PUBLIC_SMOKE_PATHS}; do
  check_http_status "${BASE_URL}${route_path}" "${route_path}"
  check_frontdoor_assets "${BASE_URL}${route_path}" "${route_path}"
done

for route_path in ${PROTECTED_REDIRECT_PATHS}; do
  check_protected_redirect "$(normalize_route_path "$route_path")" "${BASE_URL}${route_path}"
done

for route_path in ${LEGACY_NOT_FOUND_PATHS}; do
  check_not_found "$(normalize_route_path "$route_path")" "${BASE_URL}${route_path}"
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
