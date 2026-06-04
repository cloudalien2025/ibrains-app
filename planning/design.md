# iBrains Dashboard Design Standard

Last updated: 2026-05-31 (UTC)

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
2. Header must render flush to viewport top with zero blank space above it.
3. iBrains logo/wordmark in the global header must always link to `/brains`.
4. Global header account controls are required on all dashboard/admin shells:
   - Settings
   - Notifications
   - signed-in user identity
   - real Clerk log out action
5. Brain and admin pages use a common shell contract:
   - global iBrains header
   - left sidebar
   - right workspace
6. `/brains` uses the same global header but no mandatory left sidebar.
7. Use one left sidebar as the only module navigation surface.
8. Do not duplicate module navigation in horizontal tabs/links when the sidebar already contains modules.
9. Keep the first screen table/action oriented; avoid large marketing hero cards on operational dashboards.
10. `/brains` is the canonical launcher route and must render app cards; it must not redirect to `/ecomviper`.

## Visual Direction (Shell Modernization)

- Header: dark/navy high-contrast top bar with compact vertical rhythm.
- Sidebar: light panel with clear active-state navigation.
- Workspace: lighter background, compact cards/tables, tighter spacing.
- Palette: stronger blues/indigos/cyans with explicit status colors.
- Typography: sharp hierarchy, no repeated oversized hero headings.
- Responsive: desktop-first with no horizontal overflow regressions and safe mobile rendering.

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

Emergency runtime recovery update:
- `/brains` is a minimal server-rendered launcher and must not perform client stats hydration or import workspace/runtime internals.
- `/brains` cards render from the static canonical app catalog only.
- App workspaces link back to `/brains`; `/brains` must never auto-redirect to `/ecomviper`.

Hotfix 009.4 commerce/settings extension:
- EcomViper Settings includes supplier membership-tier selection for pricing calculations.
- Product Editor Commerce and right-rail cards surface selected tier context and pricing status.
- Unknown pricing must remain explicit when tier/cost source is unavailable.

Hotfix 009.8 supplier terminology:
- Settings primary diagnostics label is `Supplier Source Diagnostics`.
- Dropshipping diagnostics primary heading is `Supplier Feed Diagnostics`.
- Merchant-facing EcomViper surfaces should describe platform-managed feed data as supplier/source records without making the supplier brand the primary page label.

Hotfix 009.9 terminology updates:
- Product Editor COA surfaces should prioritize per-SKU link availability language (`View COA`, `COA Link: not found in catalog row`, `COA Link: extraction failed`) instead of repository-pending wording.
- Commerce surfaces should use explicit default-tier labels when fallback pricing is applied (for example `Non Member Pricing (default)`), not `Not selected`.

Sprint 010 Product Editor PDP Gallery redesign:
- `/ecomviper/products/[productId-or-handle]` uses a top hero section with:
  - large ecommerce-style product gallery (main image + selectable thumbnails)
  - adjacent product summary card with SKU/vendor/type/status/commerce/COA timestamps
- The old small Product Rail is removed from primary layout.
- Primary image browsing is top-of-workspace; Assets tab remains source-link and asset-URL management.
- Gallery image ordering is deterministic:
  - front/primary
  - supplement facts/back label
  - side/directions/warnings
  - 3-pack
  - 6-pack
  - lifestyle
  - original order fallback
- Merchant-facing Product Editor identity sections must avoid extraction/debug/internal key language (for example raw source diagnostics keys).
- Product Editor render remains display-only and must not trigger supplier sync, OCR/PDF extraction, or OpenAI generation at render time.

Sprint 010.1 Product Editor final layout + add-image workflow:
- Product Editor workspace must start with the hero row (Gallery left, Product Summary right); do not place a large standalone title/action card above the hero.
- Product title and shipping belong in Product Summary.
- Product edit area is full-width below hero and contains the primary action row:
  - `Generate Intelligence`
  - `Save Changes`
  - `Publish`
- `Preview PDP` is not a primary edit action in this layout.
- Publish semantics:
  - `Publish` means public publish to `ecomviper.com`.
  - If publish backend is unavailable, UI must remain explicit placeholder/disabled and must not fake success.
- Remove merchant-facing developer diagnostics from Product Editor (for example Workspace Metadata and extraction/debug keys).
- Product Gallery add-image workflow includes:
  - upload from computer (`jpeg/png/webp`, bounded file size)
  - add image by `https` URL
  - disabled future entry for Image Studio integration
- Current add-image persistence limitation is acceptable when documented: local upload preview can be temporary until media storage wiring exists.

## Non-Goals

- This standard does not define brand color palettes for every brain.
- This standard does not replace route-level auth or security guardrails.

## Internal Admin Surface (Sprint Admin Foundation)

- `/admin` is an internal operations shell and is separate from customer-facing `/brains` and `/brain` routes.
- Route convention:
  - customer workflow: `/brain`
  - internal operations: `/admin/brain`
- Admin surfaces may expose supplier/system diagnostics that must remain hidden from merchant-facing routes.
- Admin V1 is read-only diagnostics-first and should not trigger heavy extraction/build actions during route render.

## Future Shell Route Pattern

- Brain routes: `/optizon`, `/optibay`, `/directoryiq`, `/casaflix`, `/siteforge`
- Admin routes: `/admin/optizon`, `/admin/optibay`, `/admin/directoryiq`, `/admin/casaflix`, `/admin/siteforge`
- All follow the same global header + sidebar + workspace shell contract.
