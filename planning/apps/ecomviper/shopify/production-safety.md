# EcomViper Production Safety Runbook

Last updated: 2026-05-31 (UTC)

## Goal

Provide a deterministic diagnosis and recovery flow for EcomViper route saturation, 504s, and ingestion safety regressions.

## Fast Triage

1. Check service status:
   - `systemctl is-active ibrains-app`
   - `scripts/production_smoke_check.sh app.ibrains.ai`
2. Check public health and release:
   - `GET /api/health`
   - `GET /api/meta/release`
3. Check protected-route behavior signed-out:
   - `GET /brains`
   - `GET /ecomviper`
   - `GET /ecomviper/settings`
   - `GET /ecomviper/dropshipping/rocktomic`
4. Confirm responses are fast (200/307 expected depending on auth).

## 504 Diagnosis Checklist

1. Inspect app logs:
   - `journalctl -u ibrains-app`
   - app runtime log
2. Inspect nginx:
   - nginx access log
   - nginx error log
3. Confirm whether failures are:
   - global origin saturation,
   - auth redirect loop,
   - upstream dependency timeout,
   - route-specific blocking work.

## Route Timing Commands

Use max-time bounded probes:

```bash
curl -w '%{time_total}\n' -o /dev/null -s --max-time 10 https://app.ibrains.ai/api/health
curl -w '%{time_total}\n' -o /dev/null -s --max-time 10 https://app.ibrains.ai/brains
curl -w '%{time_total}\n' -o /dev/null -s --max-time 10 https://app.ibrains.ai/ecomviper
curl -w '%{time_total}\n' -o /dev/null -s --max-time 10 https://app.ibrains.ai/ecomviper/settings
curl -w '%{time_total}\n' -o /dev/null -s --max-time 10 https://app.ibrains.ai/ecomviper/dropshipping/rocktomic
```

## Safety Invariants (Must Hold)

1. `/ecomviper` does not trigger supplier ingestion when Shopify disconnected.
2. Product editor and PDP generation use supplier cache-only lookups.
3. Supplier ingestion has hard timeout + payload-size limits.
4. Supplier source errors are redacted.
5. Supplier names do not leak into shopper-facing generated output.
6. Auth protection/redirect behavior remains stable.
7. Release metadata remains populated.
8. Route-level/global error boundaries prevent blank-screen client crashes.
9. Invalid/null date or money fields never throw in client render paths.

## OpenAI/PDP Safety

1. Server-side only OpenAI requests.
2. Request timeout enforced.
3. Prompt/source context size bounded.
4. Generation fallback available when OpenAI unavailable.
5. Generation path cannot synchronously trigger source refresh/download.

## Remaining Risks

1. In-memory dedupe/cache is process-local; multi-instance refresh coordination is not yet distributed.
2. Seed fallback quality depends on last-known deterministic source mapping completeness.
3. External provider instability (Shopify/OpenAI/source URLs) still requires operational monitoring and alerting.
4. Signed-in production browser verification still requires manual execution unless a secure automation session is provisioned.

## Supplier Sync Runbook (Stabilization 009.6)

Manual sync trigger options:

1. Authenticated UI: `/ecomviper/dropshipping/rocktomic` -> `Run Source Sync`
2. Authenticated API: `POST /api/ecomviper/supplier-sources/sync`
3. Internal token script:
   - `ECOMVIPER_SYNC_INTERNAL_TOKEN=... ECOMVIPER_SYNC_USER_ID=... bash scripts/ecomviper_sync_supplier_sources.sh`
   - Internal token call to `POST /api/ecomviper/supplier-sources/sync` no longer requires a JWT-shaped `__session` cookie.

Validation after sync:

1. `GET /api/ecomviper/supplier-sources/status`
2. Confirm non-zero parsed counts where sources are accessible.
3. Confirm Product Editor no longer shows `Supplier data has not been synced for this SKU. Run source sync.` for synced SKU.

## Hotfix 009.8 Supplier Verification Runbook

Supplier sync is platform/global. Internal sync defaults to `__global__` when no explicit `ECOMVIPER_SYNC_USER_ID` is provided, and normal route reads use global normalized records after the merchant is authenticated.

Post-deploy verification:

1. Confirm `/api/meta/release` returns non-null `git_sha` and `build_id`.
2. Run bounded route timings for:
   - `/api/health`
   - `/api/meta/release`
   - `/brains`
   - `/ecomviper`
   - `/ecomviper/settings`
   - `/ecomviper/dropshipping/rocktomic`
3. Confirm Settings shows global supplier counts and membership tier options.
4. Save a merchant membership tier.
5. Open Product Editor for multiple Shopify SKUs, including at least `ROC948`, `ROC949`, and one of `ROC507` or `ROC817`.
6. Confirm Source Diagnostics show normalized product/pricing/inventory/assets record status.
7. Confirm Ingredients/Supplement Facts show extracted data or explicit OCR/source status.
8. Confirm Commerce shows cost/profit/margin only after membership tier selection.
9. Confirm inventory labels are qualitative and no unit quantities are invented.
10. Confirm Assets/COA show links or precise pending/extraction status.
11. Generate Intelligence and confirm diagnostics show `source_facts_used`.
12. Check browser console for crashes/errors and app/nginx logs for 504s or timeout growth.
13. Verify Settings tier save succeeds while signed in (no false `Sign-in required` response on valid session).
14. Verify Product Editor low-stock SKU renders `Action Required: Mark Out of Stock`.

## Admin Surface Verification (Admin Foundation V1)

Signed-out checks:

1. `/admin` redirects/protects through sign-in flow.
2. `/brains` and `/ecomviper` auth behavior remains unchanged.

Signed-in allowlisted admin checks:

1. `/admin` loads.
2. `/admin/ecomviper` loads.
3. `/admin/ecomviper/suppliers/rocktomic` loads.
4. `/admin/ecomviper/suppliers/rocktomic/audit` loads.
5. `/admin/ecomviper/suppliers/rocktomic/builds` loads.

Safety contract:

- Admin pages must not run source sync, OCR, or source extraction in page render path.
