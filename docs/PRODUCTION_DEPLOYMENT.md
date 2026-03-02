# Production Deployment (Mission Control)

## Domain
- app.ibrains.ai
- DNS must point to droplet IP: 104.236.44.185

## Build + Start
```bash
cd /root/ibrains-app
npm ci
npm run build
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
