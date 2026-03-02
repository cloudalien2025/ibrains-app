This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Operational Scripts

- `scripts/prod_smoke.sh`: quick production health checks.
- `scripts/api_smoke.sh`: minimal guard against `308`/`405` on `POST /api/brains/:id/runs`.
- `scripts/verify_runs_post.sh`: capture local + public POST verification logs to `_artifacts/phase3/`.
- `scripts/verify_diagnostics_auth.sh`: start a run, fetch diagnostics, and report PASS/FAIL.
- `scripts/verify_worker_key_routing.sh`: verify worker vs master key routing for runs + diagnostics.
- `scripts/verify_ecomviper_css.sh`: asserts `/ecomviper/products/opa-coq10-200mg/reasoning-hub` includes `/_next/static/css/` links and HUD `data-testid`s.

## Non-Negotiable Route Signatures

- Next.js route handlers must use inline `{ params }: { params: { ... } }` for the second argument.
- Do not use `RouteContext` or any custom `ctx` type aliases.
- Run `scripts/check_route_signatures.sh` before building.

## Droplet Rebuild + Restart

```bash
rm -rf .next && npm run build && sudo systemctl restart ibrains-next
```

Check env loaded:

```bash
sudo systemctl show ibrains-next --property=Environment | tr ' ' '\n' | egrep 'BRAINS_(MASTER_KEY|X_API_KEY)='
```

## SSC v1 (Ferrari)

- Migrations: `psql $DATABASE_URL -f migrations/20260227_ssc_v1.sql`
- Playwright (first-time): `npx playwright install --with-deps`
- Artifact sync to worker: `scripts/sync_ssc_artifacts_to_worker.sh`
- Operations + endpoint wiring: `docs/SSC_V1_FERRARI.md`

## EcomViper Shopify OAuth + Ingestion

### Required env vars

- `DATABASE_URL`
- `APP_BASE_URL` (example: `https://app.ibrains.ai`)
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_REDIRECT_URI` (example: `https://app.ibrains.ai/api/auth/shopify/callback`)
- `SERVER_ENCRYPTION_KEY` (32-byte key in base64 or 64-char hex)

Optional:

- `BYO_KEY_ENCRYPTION_SALT`
- `SHOPIFY_ADMIN_API_VERSION` (default: `2025-10`)

### DirectoryIQ Authority Support env vars

- `OPENAI_API_KEY` (fallback when no user-level OpenAI integration key is saved)
- `DIRECTORYIQ_OPENAI_TEXT_MODEL` (optional text model override)
- `DIRECTORYIQ_OPENAI_IMAGE_MODEL` (optional image model override)
- `DATABASE_SSL_ALLOW_SELF_SIGNED` (set to `1` for local/dev environments with self-signed Postgres cert chains)

### Shopify app setup

- App URL: `https://app.ibrains.ai`
- Allowed redirection URL: `https://app.ibrains.ai/api/auth/shopify/callback`
- OAuth scopes (MVP): `read_products,read_content`

### Connect + ingest flow

1. Open `/ecomviper/settings/integrations`.
2. Enter store domain and click **Connect Shopify**.
3. Approve install/permissions on Shopify.
4. Back in EcomViper, click **Ingest All Pages**.
5. Open a product reasoning hub: `/ecomviper/products/<handle>/reasoning-hub`.

### Key rotation (SERVER_ENCRYPTION_KEY)

1. Add a maintenance window.
2. Deploy code that can read old+new key IDs (if dual-read strategy is needed).
3. Re-encrypt `integrations.access_token_ciphertext` and `byo_api_keys.key_ciphertext` with the new key.
4. Remove old key and restart service.

### Revoke integration

- In Shopify admin: uninstall/revoke app access.
- In database: set `integrations.status='revoked'` (or delete the row).

### Production runtime env (owner-only)

Systemd (`ibrains-next`, detected on this host):

```bash
sudo mkdir -p /etc/ibrains
sudo nano /etc/ibrains/ibrains-app.env
# add SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_REDIRECT_URI, APP_BASE_URL
sudo tee /etc/systemd/system/ibrains-next.service.d/shopify-oauth.conf >/dev/null <<'EOF'
[Service]
EnvironmentFile=/etc/ibrains/ibrains-app.env
EOF
sudo systemctl daemon-reload
sudo systemctl restart ibrains-next
sudo systemctl status ibrains-next --no-pager -l
```

PM2 alternative:

```bash
pm2 start ecosystem.config.cjs --env production
pm2 restart ibrains-app --update-env
pm2 logs ibrains-app --lines 120
```

Verification:

```bash
curl -I "http://127.0.0.1:3001/api/auth/shopify/start?shop=opanutrition.myshopify.com"
curl -I "https://app.ibrains.ai/api/auth/shopify/start?shop=opanutrition.myshopify.com"
npm run build
npm run test
```
