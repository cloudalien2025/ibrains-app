# Prod Hardening Notes (Phase 3)

Date: 2026-02-27

## Environment Facts
- OS: Ubuntu 22.04.5 LTS (jammy)
- Kernel: 5.15.0-170-generic
- Node: v20.20.0
- Nginx: 1.18.0 (already installed)
- Repo branch: feat/mission-control-phase3 (clean, except task doc)

## App Runtime
- Current health check: http://127.0.0.1:3001/api/health -> 200 { ok: true }
- Current env file: /root/ibrains-app/.env.production.local
  - BRAINS_API_BASE=http://127.0.0.1:8000

## Networking
- Public IP: 104.236.44.185
- Domain: app.ibrains.ai
- DNS A record for app.ibrains.ai currently resolves to:
  - c7000cff8e3f7577.vercel-dns-017.com
  - 216.198.79.65
  - 64.29.17.65
- DNS is NOT pointing to this droplet yet, so HTTPS/certbot must wait.

## Nginx Status
- Nginx running with existing sites:
  - api.ibrains.ai -> 127.0.0.1:8000 (TLS via certbot)
  - ibrains.ai / www.ibrains.ai -> static site (TLS via certbot)
  - worker.aiohut.com -> 127.0.0.1:8000 (TLS via certbot)

## Required DNS Update
- Create/Update A record:
  - app.ibrains.ai -> 104.236.44.185
- Once DNS resolves to this droplet, proceed with certbot for app.ibrains.ai.

## Phase 3 Actions Completed (So Far)
- systemd service: /etc/systemd/system/ibrains-app.service
- App logs: /var/log/ibrains-app/app.log
- Nginx reverse proxy (HTTP): /etc/nginx/sites-available/ibrains-app.conf
- UFW enabled: OpenSSH + Nginx Full only
- Logrotate: /etc/logrotate.d/ibrains-app
- Smoke test script: scripts/prod_smoke.sh

## Pending
- TLS cert for app.ibrains.ai (certbot) once DNS points to 104.236.44.185
- HTTPS validation + cert auto-renew verification
