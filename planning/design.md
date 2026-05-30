# iBrains Dashboard Design Standard

Last updated: 2026-05-30 (UTC)

## Scope

This standard defines operational dashboard layout contracts for all brain consoles:

- `/ecomviper`
- `/optibay`
- `/optiwal`
- `/optizon`
- `/casaflix`
- `/pagebolt`
- future brain dashboards

Terminology rule:
- User-facing platform launcher naming is `iBrains Dashboard`.
- `BrainOS` is internal architecture terminology and should not appear in customer/operator UI copy.

## Global Structure

1. Use one compact global iBrains header at the top of each dashboard workspace.
2. Use one left sidebar as the only module navigation surface.
3. Do not duplicate module navigation in horizontal tabs/links when the sidebar already contains modules.
4. Keep the first screen table/action oriented; avoid large marketing hero cards on operational dashboards.
5. `/brains` is the canonical launcher route and must render app cards; it must not redirect to `/ecomviper`.

## Brain Identity Rules

1. Global header shows iBrains platform identity.
2. Sidebar header shows current brain icon/logo and brain name.
3. Brain icon size should stay consistent in the 24-32px range.
4. Brain icon and name must render together in sidebar identity row.
5. Include a compact workspace status row below brain identity so operators can read connection state above the fold.
6. Back-link copy from app workspaces should use `← iBrains Dashboard` or `← All Apps`, linking to `/brains`.

## Workspace Row Contract

Dashboards should include a compact status row near top with operational metadata, for example:

- workspace/store name
- Shopify/source connection states
- AI connection state
- product count
- last sync timestamp

## Table-First Operational Layout

1. Keep filters and product/action table above the fold whenever practical.
2. Use compact cards only for operator-critical metadata.
3. Preserve row-click actions into product/editor workflows.

## EcomViper-Specific Application

Sprint 008.2 applies this standard to `/ecomviper`:

- Sidebar modules: Products, Image Studio, Dropshipping, Agentic Visibility, Settings.
- Shopify no longer presents as a separate child workspace at `/ecomviper/shopify`.
- `/ecomviper/shopify` redirects to `/ecomviper/settings`.
- Rocktomic diagnostics remain available via Dropshipping route and Settings diagnostics.

Sprint 009 extends this standard into the Product Editor workspace:

- compact product breadcrumb + status chips
- left product rail + center tab workspace + right intelligence rail
- no duplicate horizontal module navigation
- all high-value product intelligence controls visible above fold on desktop

Hotfix 009.2 naming and launcher alignment:
- `/brains` renders the iBrains Dashboard launcher with app cards and icon + name + description + open action.
- Merchant-facing EcomViper dashboard copy should stay supplier-neutral in primary UI (for example `Supplier Feed`, `Supplier Records`, `Open supplier diagnostics`).

## Non-Goals

- This standard does not define brand color palettes for every brain.
- This standard does not replace route-level auth or security guardrails.
