# Permanent Repo Discipline Protocol (PRDP) v1

This repo follows PRDP v1 to prevent merge stalls, branch confusion, and “whack-a-mole” debugging.

---

## 0) Golden Rules
1) One change = one branch = one PR.
2) `main` is always releasable (CI green or it doesn’t land).
3) No-op branches (0 commits ahead) are NOT errors — they are a status.
4) Everything must be reproducible via CLI (Codex-first workflow).

---

## 1) Branch Naming Standard
- feat/<area>-<short-desc>
- fix/<area>-<short-desc>
- chore/<area>-<short-desc>
- ops/<area>-<short-desc>

Never reuse a branch name after merge. Use -v2, -v3 for retries.

---

## 2) Truth Source Rule
Truth is origin/main.

Required sync ritual:
git fetch origin --prune
git checkout main
git pull --ff-only

---

## 3) No-Op Branch Handling

Canonical check:
git rev-list --left-right --count origin/main...HEAD

Interpretation:
0 0 → identical to main (no-op)
0 X → behind main
Y 0 → ahead of main
Y X → diverged

Policy:
No-op must EXIT SUCCESS.

---

## 4) Commit Discipline
Message format:
fix(ui): preview button routes correctly
feat(directoryiq): serp-driven outline builder
chore(repo): quarantine orphaned files
ops(deploy): add logrotate + ufw rules

No WIP commits.
No secrets in git.
Add .env.example for every new env var.

---

## 5) 30-Second Repo Reality Check

git fetch origin --prune
git status -sb
git log --oneline --decorate -n 5
git rev-list --left-right --count origin/main...HEAD

---

## 6) Done Means Done

git checkout main
git pull --ff-only

---

## 7) Auto-Merge Green PRs

Use the auto-merge helper to squash-merge and delete the branch:

pnpm -s pr:automerge <PR_NUMBER>
