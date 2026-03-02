#!/usr/bin/env bash
set -euo pipefail

PASS="✅"
WARN="⚠️"
FAIL="❌"

require_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "${FAIL} Not inside a git repository."
    exit 1
  }
}

main_branch_name() {
  ref="$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [[ -n "${ref}" ]]; then
    echo "${ref#origin/}"
  else
    echo "main"
  fi
}

print_header() {
  echo "========================================"
  echo "PRDP Repo Health Check"
  echo "========================================"
}

check_fetch() {
  git fetch origin --prune >/dev/null 2>&1 || true
}

check_worktree() {
  if [[ -z "$(git status --porcelain)" ]]; then
    echo "${PASS} Working tree clean"
  else
    echo "${WARN} Working tree NOT clean"
    git status -sb
  fi
}

check_noop_vs_main() {
  main_branch="$(main_branch_name)"
  base="origin/main"

  if ! git rev-parse --verify "${base}" >/dev/null 2>&1; then
    echo "${WARN} Cannot find ${base}"
    return
  fi

  read -r behind ahead < <(git rev-list --left-right --count "${base}...HEAD")

  echo "Compare vs ${base}: ahead=${ahead} behind=${behind}"

  if [[ "$ahead" == "0" && "$behind" == "0" ]]; then
    echo "${PASS} NO-OP branch (identical to main)"
    return
  fi

  if [[ "$ahead" == "0" && "$behind" != "0" ]]; then
    echo "${WARN} Behind main"
    return
  fi

  if [[ "$ahead" != "0" && "$behind" == "0" ]]; then
    echo "${PASS} Ahead of main (mergeable)"
    return
  fi

  echo "${WARN} Diverged from main"
}

print_footer() {
  echo "========================================"
}

main() {
  require_git_repo
  print_header
  check_fetch
  check_worktree
  check_noop_vs_main
  print_footer
}

main
