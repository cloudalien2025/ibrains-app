#!/usr/bin/env bash
# Remove untracked working-tree files that an incoming pull would overwrite.
#
# `git pull --ff-only` aborts with "untracked working tree files would be
# overwritten by merge" when a path exists untracked in the deploy checkout but
# is tracked in the incoming commit (e.g. a tool-generated scaffold that was
# later committed upstream). This guard clears exactly those conflicts before
# the pull.
#
# Removal is lossless and conservative: a file is removed ONLY when the same
# path also exists in the target ref, so the pull restores the canonical tracked
# version. Ignored files (e.g. .env.production.local) are never considered, and
# untracked files that are NOT present in the target ref are left untouched.
#
# Usage: guard-untracked-pull-conflicts.sh [TARGET_PATH] [TARGET_REF]
#   TARGET_PATH  deploy checkout (default: /root/ibrains-app)
#   TARGET_REF   already-fetched ref to compare against (default: origin/main)
set -euo pipefail

TARGET_PATH="${1:-/root/ibrains-app}"
TARGET_REF="${2:-origin/main}"

fail() {
  echo "untracked-pull-conflict guard failed: $*" >&2
  exit 1
}

[ -d "${TARGET_PATH}" ] || fail "missing target path ${TARGET_PATH}"
git -C "${TARGET_PATH}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git worktree: ${TARGET_PATH}"
git -C "${TARGET_PATH}" rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1 \
  || fail "target ref not found: ${TARGET_REF} (fetch before running this guard)"

removed=0
# NUL-delimited untracked, non-ignored files (handles spaces/newlines in names).
while IFS= read -r -d '' path; do
  # Only a conflict when the same path also exists in the target tree.
  if git -C "${TARGET_PATH}" cat-file -e "${TARGET_REF}:${path}" 2>/dev/null; then
    echo "untracked-pull-conflict guard: removing ${path} (tracked in ${TARGET_REF}; pull would overwrite)"
    rm -f -- "${TARGET_PATH}/${path}"
    removed=$((removed + 1))
  fi
done < <(git -C "${TARGET_PATH}" ls-files --others --exclude-standard -z)

echo "untracked-pull-conflict guard: removed ${removed} conflicting untracked file(s) against ${TARGET_REF}"
