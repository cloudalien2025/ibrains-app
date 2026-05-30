# EcomViper Production Safety Runbook

Last updated: 2026-05-30 (UTC)

## Goal

Provide a deterministic diagnosis and recovery flow for EcomViper route saturation, 504s, and ingestion safety regressions.

## Fast Triage

1. Check service status:
   - `systemctl is-active ibrains-app`
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
