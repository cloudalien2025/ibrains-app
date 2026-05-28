# Production Deployment (GitLab Authority)

## Domain
- app.ibrains.ai
- DNS must point to droplet IP: 104.236.44.185

## Authoritative Deploy Path
- Production deploy authority is `.gitlab-ci.yml`.
- GitHub Actions deploy orchestration is retired for this repository.
- Merges to the GitLab default branch build a release artifact, write release metadata, deploy over SSH, and run frontdoor integrity smoke checks before the deploy is considered healthy.

## GitLab CI Variables
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT` (optional, default `22`)
- `DEPLOY_PATH`
- `SERVICE_NAME` (optional, defaults to `ibrains-app`)
- `DEPLOY_KNOWN_HOSTS` (optional, recommended)

## Manual Build + Start
```bash
cd /root/ibrains-app
npm ci
npm run build
bash scripts/apply_directoryiq_schema.sh
sudo systemctl restart ibrains-app
sudo systemctl status ibrains-app --no-pager
```

## Service Management
```bash
sudo systemctl start ibrains-app
sudo systemctl stop ibrains-app
sudo systemctl restart ibrains-app
sudo systemctl is-active ibrains-app
```

## Logs
- App logs: `/var/log/ibrains-app/app.log`
- Nginx logs: `/var/log/nginx/app.ibrains.ai.access.log`, `/var/log/nginx/app.ibrains.ai.error.log`

```bash
tail -f /var/log/ibrains-app/app.log
sudo tail -f /var/log/nginx/app.ibrains.ai.access.log
sudo tail -f /var/log/nginx/app.ibrains.ai.error.log
```

## Health Checks
```bash
curl -sS http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1/api/health -H 'Host: app.ibrains.ai'
```

## Smoke Test Script
```bash
# HTTPS (after DNS + certbot)
/root/ibrains-app/scripts/prod_smoke.sh app.ibrains.ai

# HTTP fallback if TLS not yet enabled
PROTO=http /root/ibrains-app/scripts/prod_smoke.sh app.ibrains.ai

# Local HTTP with explicit Host header (bypasses DNS)
BASE_URL=http://127.0.0.1 HOST_HEADER=app.ibrains.ai /root/ibrains-app/scripts/prod_smoke.sh app.ibrains.ai
```

`prod_smoke.sh` now validates `/_next/static/*` assets referenced by `/`, `/dashboard`, and `/sign-in`. It fails on non-`200` responses and on wrong JS/CSS content types so HTML/chunk mismatch deploys cannot pass smoke.

## TLS (Let’s Encrypt)
Only run after DNS A record for app.ibrains.ai points to 104.236.44.185.

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.ibrains.ai
sudo systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```

## Firewall
```bash
sudo ufw status verbose
```

## Environment Variables
- `/root/ibrains-app/.env.production.local`
- Required by server routes:
  - `BRAINS_API_BASE` (example: `http://127.0.0.1:8000`)
  - `DATABASE_URL`
  - `DIRECTORYIQ_DATABASE_URL` (preferred for DirectoryIQ-owned `directoryiq_*` tables; falls back to `DATABASE_URL`)
- Optional for UI:
  - `NEXT_PUBLIC_WORKER_URL`

## Rollback
```bash
# Stop app
sudo systemctl stop ibrains-app

# Disable site (if needed)
sudo rm -f /etc/nginx/sites-enabled/ibrains-app.conf
sudo systemctl reload nginx

# Re-enable default site (if needed)
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo systemctl reload nginx
```
