# DirectoryIQ Dashboard Operational Audit

## Scope
Audited current dashboard implementation:
- `app/apps/directoryiq/directoryiq-dashboard-client.tsx`
- `components/directoryiq/DirectoryIqTopNav.tsx`
- route inventory under `app/apps/directoryiq/**`

## Dashboard state/action audit

### 1. Website connection status chip
- Surface: `Website Connected` / `Website Not Connected` badge in top nav.
- User question: "Where do I connect or manage my website source?"
- Natural next action: open source/connection management.
- Correct destination: `/apps/directoryiq/signal-sources` (with optional connector hint).
- Route presence: exists.
- Gap before fix: status was informational-only (no CTA).

### 2. Detected vertical + refresh controls
- Surface: vertical selector and `Refresh Analysis` button.
- User question: "Where do I tune deeper config if refresh/vertical behavior is not enough?"
- Natural next action: open settings.
- Correct destination: `/apps/directoryiq/settings`.
- Route presence: exists.
- Gap before fix: no explicit route-level CTA from dashboard state/error.

### 3. AI Selection Readiness card
- Surface: readiness score + pillars.
- User question: "What workflow should I use to improve readiness?"
- Natural next action: authority and graph integrity workflows.
- Correct destinations:
  - `/apps/directoryiq/authority`
  - `/apps/directoryiq/graph-integrity`
- Route presence: both exist.
- Gap before fix: card showed metrics but no action paths.

### 4. Listings section (empty state)
- Surface: "No listings found yet. Connect and refresh analysis."
- User question: "Where do I connect/sync sources so listings appear?"
- Natural next action: connect website/source and then open listings workflow.
- Correct destinations:
  - `/apps/directoryiq/signal-sources?connector=brilliant-directories`
  - `/apps/directoryiq/signal-sources`
  - `/apps/directoryiq/listings`
- Route presence: all exist.
- Gap before fix: empty state text had no action links.

### 5. Listings section (non-empty)
- Surface: row-level `Improve` links.
- User question: "How do I open full listings workflow?"
- Natural next action: open listings index and/or listing detail.
- Correct destinations:
  - row-level: `/apps/directoryiq/listings/[listingId]` (already present)
  - section-level: `/apps/directoryiq/listings`
- Route presence: both exist.
- Gap before fix: row action existed, but no explicit section-level CTA.

### 6. Dashboard error state
- Surface: dashboard load error message.
- User question: "Where do I go to fix data/source/config issues?"
- Natural next action: open signal sources and settings.
- Correct destinations:
  - `/apps/directoryiq/signal-sources`
  - `/apps/directoryiq/settings`
- Route presence: both exist.
- Gap before fix: error showed message only, no remediation navigation.

## Route/workflow mapping table

| Dashboard surface | Desired user action | Destination route | CTA type | Route exists |
|---|---|---|---|---|
| Website status chip | Connect/manage website source | `/apps/directoryiq/signal-sources?connector=brilliant-directories` | Inline status CTA button | Yes |
| Readiness card | Improve authority signals | `/apps/directoryiq/authority` | Card action button | Yes |
| Readiness card | Inspect structural/link integrity | `/apps/directoryiq/graph-integrity` | Card action button | Yes |
| Readiness error | Fix sources | `/apps/directoryiq/signal-sources` | Inline remediation link | Yes |
| Readiness error | Adjust settings | `/apps/directoryiq/settings` | Inline remediation link | Yes |
| Listings empty state | Connect source for ingestion | `/apps/directoryiq/signal-sources?connector=brilliant-directories` | Empty-state CTA | Yes |
| Listings empty state | Configure/manage connectors | `/apps/directoryiq/signal-sources` | Empty-state CTA | Yes |
| Listings section | Open listings workflow | `/apps/directoryiq/listings` | Card action button | Yes |
| Listings row | Optimize a specific listing | `/apps/directoryiq/listings/[listingId]` | Row action button | Yes |

## Implementation plan
- Update `DirectoryIqTopNav` to make website status actionable via direct CTA.
- Update dashboard readiness card to include workflow CTAs for authority and graph integrity.
- Update dashboard empty/error states to include explicit remediation links.
- Keep routing unchanged; only wire to existing routes.
- No `/brains/**` changes, no SiteForge changes, no DB/env changes.
