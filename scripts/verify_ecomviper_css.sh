#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
ROUTE="/ecomviper/products/opa-coq10-200mg/reasoning-hub"

html="$(curl -sS --retry 10 --retry-connrefused --retry-delay 1 "${BASE_URL}${ROUTE}")"

if ! grep -q '/_next/static/css/' <<<"$html"; then
  echo "FAIL: HTML missing /_next/static/css/ links"
  exit 1
fi

echo "PASS: HTML includes /_next/static/css/"

if ! grep -q 'data-testid="ecomviper-sidebar"' <<<"$html"; then
  echo "FAIL: missing data-testid=ecomviper-sidebar"
  exit 1
fi

echo "PASS: sidebar test id found"

if ! grep -q 'data-testid="ecomviper-topbar"' <<<"$html"; then
  echo "FAIL: missing data-testid=ecomviper-topbar"
  exit 1
fi

echo "PASS: topbar test id found"

css_path="$(grep -o '/_next/static/css/[^" ]*\.css' <<<"$html" | head -n 1)"
if [[ -z "$css_path" ]]; then
  echo "FAIL: could not extract css path"
  exit 1
fi

headers="$(curl -sS --retry 10 --retry-connrefused --retry-delay 1 -I "${BASE_URL}${css_path}")"
if ! grep -q '200 OK' <<<"$headers"; then
  echo "FAIL: css asset not reachable at ${BASE_URL}${css_path}"
  exit 1
fi
if ! grep -qi 'content-type: text/css' <<<"$headers"; then
  echo "FAIL: css asset content-type is not text/css"
  exit 1
fi

echo "PASS: css asset reachable ${BASE_URL}${css_path}"
echo "PASS: EcomViper CSS regression check passed"
