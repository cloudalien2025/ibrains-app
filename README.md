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
