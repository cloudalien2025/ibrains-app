# Codespaces + GitHub Actions Deployment

This setup avoids droplet DNS/npm/GitHub dependency by building in GitHub and shipping a release tarball over SSH.

## 1) Required GitHub Actions Secrets

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

Workflow: `.github/workflows/ci_directoryiq.yml`

Triggers:
- Pull requests to `main`
- Push to `fix/**` branches

Checks:
- `pnpm install --frozen-lockfile`
- `pnpm vitest --run`
- `pnpm build`

## 4) Deploy Workflow

Workflow: `.github/workflows/deploy_app.yml`

Trigger:
- Manual (`workflow_dispatch`)

Flow:
1. Checkout + Node 20 + `pnpm install --frozen-lockfile`
2. `pnpm build`
3. Create tarball with runtime files (`.next`, `node_modules`, config, public, manifests)
4. Upload tarball via `scp` to `${DEPLOY_PATH}/.deploy/incoming/<sha>.tgz`
5. Extract to `${DEPLOY_PATH}/.deploy/releases/<sha>`
6. `rsync` release contents into `${DEPLOY_PATH}`
7. Restart service and health-check `http://127.0.0.1:3001/brains`

No droplet `git pull` is used.
