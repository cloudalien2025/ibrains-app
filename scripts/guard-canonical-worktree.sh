#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="${1:-/root/ibrains-app}"

fail() {
  echo "canonical worktree guard failed: $*" >&2
  exit 1
}

[ -d "${TARGET_PATH}" ] || fail "missing target path ${TARGET_PATH}"
[ -e "${TARGET_PATH}/.git" ] || fail "missing ${TARGET_PATH}/.git"

git -C "${TARGET_PATH}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git worktree"
git -C "${TARGET_PATH}" remote get-url origin >/dev/null 2>&1 || fail "origin remote is not configured"
git -C "${TARGET_PATH}" status --short --branch >/dev/null 2>&1 || fail "git status failed"

current_sha="$(git -C "${TARGET_PATH}" rev-parse --short HEAD)"
echo "canonical worktree guard passed: ${TARGET_PATH} @ ${current_sha}"
