# Phase 3 Hardening Checklist (Mission Control)

Date: 2026-02-27

## A) Nginx Reverse Proxy + HTTPS
- [x] Nginx reverse proxy configured for `app.ibrains.ai` (HTTP only)
- [ ] TLS cert via Let’s Encrypt (pending DNS)
- [ ] HTTP -> HTTPS redirect (pending certbot)

## B) Firewall Lockdown
- [x] UFW enabled
- [x] OpenSSH allowed
- [x] Nginx Full (80/443) allowed
- [x] Default deny incoming

## C) Production Logging + Rotation
- [x] App logs to `/var/log/ibrains-app/app.log`
- [x] Nginx access/error logs in `/var/log/nginx/`
- [x] Logrotate config for app logs (`/etc/logrotate.d/ibrains-app`)
- [x] Logrotate dry-run OK

## D) Ingestion Workflow Smoke Tests
- [x] `scripts/prod_smoke.sh` created
- [ ] HTTPS smoke tests (blocked until DNS + TLS)

## E) Real Domain
- [x] Domain set to `app.ibrains.ai`
- [ ] DNS A record must point to 104.236.44.185

## F) Phase 3 Docs + Hardening Checks
- [x] `docs/PROD_HARDENING_NOTES.md`
- [x] `docs/PRODUCTION_DEPLOYMENT.md`
- [x] `docs/PHASE3_HARDENING_CHECKLIST.md`

## Verification Commands
```bash
systemctl is-active ibrains-app
curl -sS http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1/api/health -H 'Host: app.ibrains.ai'
ufw status verbose
sudo logrotate -d /etc/logrotate.d/ibrains-app
```

## TLS Pending Steps
```bash
# After DNS A record points to 104.236.44.185
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.ibrains.ai
sudo systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```
