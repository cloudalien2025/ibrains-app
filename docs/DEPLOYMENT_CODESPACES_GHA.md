# Codespaces + GitLab CI Deployment

This setup uses GitLab CI as the tracked production deployment authority. GitHub Actions deploy orchestration is retired for this repository to avoid split deploy paths.

## 1) Required GitLab CI Variables

- `DEPLOY_HOST` (example: `104.236.44.185`)
- `DEPLOY_USER` (example: `root`)
- `DEPLOY_SSH_KEY` (private key with droplet access)
- `DEPLOY_PORT` (optional, default: `22`)
- `DEPLOY_PATH` (example: `/root/ibrains-app`)
- `SERVICE_NAME` (example: `ibrains-app`)
- `DEPLOY_KNOWN_HOSTS` (optional, recommended from `ssh-keyscan`)

## 2) Codespaces Development

The repo includes:
- `.devcontainer/devcontainer.json`
- `.devcontainer/postCreateCommand.sh`

On create, it runs:
- `corepack enable`
- `pnpm install`

Then run:

```bash
pnpm vitest --run
pnpm build
```

## 3) CI Build Gate

Pipeline file: `.gitlab-ci.yml`

Triggers:
- Merge requests
- Branch pushes

Checks:
- `pnpm install --frozen-lockfile`
- `pnpm vitest --run`
- `pnpm build`

## 4) Deploy Workflow

Pipeline job: `deploy_production`

Trigger:
- Default branch pipeline

Flow:
1. Install dependencies and run frontdoor integrity verification.
2. Write `app/_meta/release.json` from GitLab pipeline metadata.
3. Build the Next.js release artifact and upload `artifacts/build.tar.gz`.
4. Copy the artifact to the droplet over SSH.
5. Extract to staging, run `npm ci --omit=dev`, and apply the tracked DirectoryIQ schema.
6. `rsync` the staged release into `${DEPLOY_PATH}`.
7. Restart the service and run `scripts/prod_smoke.sh` against both `http://127.0.0.1:3001` and `https://app.ibrains.ai`.

No droplet `git pull` is used.
