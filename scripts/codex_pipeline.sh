#!/usr/bin/env bash
set -euo pipefail

say() {
  echo "[codex] $*"
}

fail() {
  echo "[codex] ERROR: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || fail "gh CLI not installed"

gh auth status -h github.com >/dev/null 2>&1 || fail "gh not authenticated"

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
if [[ -z "$branch" ]]; then
  fail "not in a git repository"
fi
if [[ "$branch" == "main" ]]; then
  fail "refusing to run on main"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  fail "working tree not clean; commit or stash changes before running codex pipeline"
fi

if [[ ! -d node_modules ]]; then
  say "Installing dependencies"
  pnpm install
fi

say "Running unit tests"
pnpm test

say "Building"
pnpm -s next build

say "Running e2e (CI deterministic)"
pnpm test:e2e:ci

if [[ -n "$(git status --porcelain)" ]]; then
  say "Committing changes"
  git add -A
  git commit -m "chore(automation): codex pipeline + auto-merge wiring"
else
  say "No changes to commit"
fi

say "Pushing branch"
git push -u origin HEAD

pr_number=$(gh pr view --json number -q .number 2>/dev/null || true)
if [[ -z "$pr_number" ]]; then
  say "Creating PR"
  gh pr create --base main --head "$branch" --title "chore(automation): codex pipeline" --body "## Summary\n- Run codex pipeline\n- Auto-enable squash merge\n\n## Testing\n- pnpm test\n- pnpm -s next build\n- pnpm test:e2e:ci"
  pr_number=$(gh pr view --json number -q .number 2>/dev/null || true)
fi

if [[ -z "$pr_number" ]]; then
  fail "unable to determine PR number"
fi

say "Enabling auto-merge for PR #$pr_number"
gh pr merge "$pr_number" --auto --squash --delete-branch

say "Codex pipeline complete"
