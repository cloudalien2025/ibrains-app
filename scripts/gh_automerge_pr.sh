#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER_INPUT="${1:-${PR_NUMBER:-}}"
TIMEOUT_MIN="${TIMEOUT_MIN:-30}"
DRY_RUN="${DRY_RUN:-0}"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY_RUN: $*"
    return 0
  fi
  "$@"
}

run_cmd_capture() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY_RUN: $*"
    return 0
  fi
  "$@"
}

command -v gh >/dev/null 2>&1 || fail "gh CLI not installed"

if [[ "$DRY_RUN" != "1" ]]; then
  gh auth status -h github.com >/dev/null 2>&1 || fail "gh not authenticated"
fi

PR="$PR_NUMBER_INPUT"
if [[ -z "$PR" ]]; then
  PR=$(gh pr view --json number -q .number 2>/dev/null || true)
fi
if [[ -z "$PR" ]]; then
  HEAD_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  if [[ -n "$HEAD_BRANCH" ]]; then
    PR=$(gh pr list --head "$HEAD_BRANCH" --json number -q '.[0].number' 2>/dev/null || true)
  fi
fi

if [[ -z "$PR" ]]; then
  fail "no PR found for current branch (set PR_NUMBER or pass arg)"
fi

echo "PR: $PR"
echo "Timeout: ${TIMEOUT_MIN} minutes"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN: gh pr checks $PR --watch --fail-fast"
  echo "DRY_RUN: gh pr merge $PR --squash --delete-branch"
  echo "DRY_RUN: gh pr view $PR --json merged,mergeCommit --jq '.merged, .mergeCommit.oid'"
  exit 0
fi

echo "Waiting for checks to pass..."
checks_output=$(gh pr checks "$PR" --watch --fail-fast 2>&1 || true)
if [[ -n "$checks_output" ]]; then
  echo "$checks_output"
fi
if echo "$checks_output" | rg -q "unknown flag|unknown command|not supported"; then
  echo "Falling back to polling checks..."
  start_ts=$(date +%s)
  timeout_s=$((TIMEOUT_MIN * 60))
  while true; do
    conclusions=$(gh pr view "$PR" --json statusCheckRollup -q '.statusCheckRollup[].conclusion' 2>/dev/null || true)
    if [[ -z "$conclusions" ]]; then
      echo "Checks pending..."
    else
      fatal=false
      pending=false
      while IFS= read -r conclusion; do
        case "$conclusion" in
          SUCCESS|NEUTRAL|SKIPPED)
            ;;
          ""|null|IN_PROGRESS|PENDING)
            pending=true
            ;;
          *)
            fatal=true
            ;;
        esac
      done <<< "$conclusions"

      if [[ "$fatal" == "true" ]]; then
        fail "checks failed"
      fi
      if [[ "$pending" == "false" ]]; then
        break
      fi
      echo "Checks pending..."
    fi

    now_ts=$(date +%s)
    if (( now_ts - start_ts > timeout_s )); then
      fail "checks did not complete within ${TIMEOUT_MIN} minutes"
    fi
    sleep 20
  done
fi

echo "Merging PR $PR..."
run_cmd gh pr merge "$PR" --squash --delete-branch

echo "Merge status:"
run_cmd gh pr view "$PR" --json merged,mergeCommit --jq '.merged, .mergeCommit.oid'
