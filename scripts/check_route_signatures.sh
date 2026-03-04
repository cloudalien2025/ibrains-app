#!/usr/bin/env bash
set -u

fail=0

check() {
  local pattern="$1"
  local label="$2"
  local matches

  matches="$(rg -n "$pattern" app/api || true)"
  if [ -n "$matches" ]; then
    echo "Found ${label}:"
    echo "$matches"
    echo
    fail=1
  fi
}

check "RouteContext" "RouteContext usage"
check "\\{\\s*params\\s*\\}:\\s*Promise<" "Promise-wrapped params"
check "export async function (GET|POST|PUT|DELETE|PATCH)\\([^\\)]*,\\s*ctx:" "ctx-typed second argument"

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "Route handler signatures OK."
exit 0
