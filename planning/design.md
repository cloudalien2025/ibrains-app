# iBrains BrainOS Dashboard Design Standard

Last updated: 2026-05-29 (UTC)

## Scope

This standard defines operational dashboard layout contracts for all brain consoles:

- `/ecomviper`
- `/optibay`
- `/optiwal`
- `/optizon`
- future brain dashboards

## Global Structure

1. Use one compact global iBrains header at the top of each dashboard workspace.
2. Use one left sidebar as the only module navigation surface.
3. Do not duplicate module navigation in horizontal tabs/links when the sidebar already contains modules.
4. Keep the first screen table/action oriented; avoid large marketing hero cards on operational dashboards.

## Brain Identity Rules

1. Global header shows iBrains platform identity.
2. Sidebar header shows current brain icon/logo and brain name.
3. Brain icon size should stay consistent in the 24-32px range.
4. Brain icon and name must render together in sidebar identity row.

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

## Non-Goals

- This standard does not define brand color palettes for every brain.
- This standard does not replace route-level auth or security guardrails.
