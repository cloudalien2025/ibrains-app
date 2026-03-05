# Automation Workflow

## Day-to-day
1. Create a branch:

   git checkout -b fix/your-change

2. Make changes.
3. Run the one-command pipeline:

   pnpm codex:run

4. Walk away. If checks pass, the PR auto-merges (squash) and deletes the branch.

## What the pipeline does
- `pnpm test`
- `pnpm -s next build`
- `pnpm test:e2e:ci`
- Commit + push
- Create or update PR
- Enable auto-merge (squash) + delete branch

## Troubleshooting
- Check failed CI logs:

  gh run list --limit 5
  gh run view <RUN_ID> --log-failed

- If Vercel fails, verify `vercel.json` schema.

## Auto-merge behavior
- Eligible PRs automatically enable auto-merge when checks are green.
- Add the label `no-automerge` to opt out.
- Branches are deleted after merge via GitHub auto-delete or the merge command.

## Security note
Mock mode is CI-only via environment variable `E2E_MOCK_GRAPH=1` and does not affect production.
