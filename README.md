This is the iBrains app repository, built on [Next.js](https://nextjs.org).

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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) for font optimization.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) for framework details.

## Operational Scripts

- `scripts/prod_smoke.sh`: quick production health checks.
- `scripts/api_smoke.sh`: minimal guard against `308`/`405` on `POST /api/brains/:id/ingest`.
- `scripts/verify_runs_post.sh`: capture local + public POST verification logs to `_artifacts/phase3/`.
- `scripts/verify_diagnostics_auth.sh`: start a run, fetch diagnostics, and report PASS/FAIL.
- `scripts/verify_worker_key_routing.sh`: verify worker vs master key routing for runs + diagnostics.

## Non-Negotiable Route Signatures

- Next.js route handlers must use inline `{ params }: { params: { ... } }` for the second argument.
- Do not use `RouteContext` or any custom `ctx` type aliases.
- Run `scripts/check_route_signatures.sh` before building.

## Release Metadata

Use `GET /api/meta/release` (or legacy alias `GET /api/_meta/release`) to see the exact build running in an environment.

Fields:
- `service`: app/service name (`ibrains`).
- `environment`: `production`, `staging`, `development`, or `local`.
- `git_sha`: full commit SHA (if available).
- `git_sha_short`: short SHA (first 7 chars).
- `build_timestamp`: UTC build time (`YYYY-MM-DDTHH:mm:ssZ`) or `null` if unknown.
- `build_id`: CI/build identifier (if available).
- `local`: boolean indicating local/dev fallback.
- `sources`: where each value came from (`env`, `file`, `default`, or `missing`).

Compare deployments:
- Fetch `/api/meta/release` locally and in production, then compare `git_sha` and `build_timestamp`.
- A stale deployment is obvious if production `git_sha` does not match the expected commit or the `build_timestamp` is older than the intended release.

Local/dev fallback:
- If CI metadata is absent, the endpoint returns `environment: "local"` and `git_sha`/`build_timestamp` may be `null`.
- For deterministic local testing, set `RELEASE_GIT_SHA`, `RELEASE_BUILD_TIMESTAMP`, and `APP_ENV` or provide `app/_meta/release.json`.

## Droplet Rebuild + Restart

```bash
rm -rf .next && npm run build && sudo systemctl restart ibrains-next
```

Check env loaded:

```bash
sudo systemctl show ibrains-next --property=Environment | tr ' ' '\n' | egrep 'BRAINS_(MASTER_KEY|X_API_KEY)='
```
