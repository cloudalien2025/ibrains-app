#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-app/_meta/release.json}"
GIT_SHA="${2:-${CI_COMMIT_SHA:-}}"
BUILD_ID="${3:-${CI_PIPELINE_ID:-}}"
BUILD_TIMESTAMP="${4:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
SERVICE_NAME="${5:-ibrains}"
ENVIRONMENT="${6:-production}"
SOURCE_NAME="${7:-gitlab_ci}"

SHORT_SHA="${GIT_SHA:0:7}"
mkdir -p "$(dirname "$OUT_PATH")"

tmp_file="$(mktemp "${OUT_PATH}.tmp.XXXXXX")"
cat > "$tmp_file" <<EOF
{
  "service": "${SERVICE_NAME}",
  "environment": "${ENVIRONMENT}",
  "git_sha": "${GIT_SHA}",
  "git_sha_short": "${SHORT_SHA}",
  "build_timestamp": "${BUILD_TIMESTAMP}",
  "build_id": "${BUILD_ID}",
  "source": "${SOURCE_NAME}"
}
EOF

mv -f "$tmp_file" "$OUT_PATH"
