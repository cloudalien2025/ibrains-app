# DirectoryIQ Full Style Audit

Date: 2026-04-23  
Scope: `app/directoryiq/**`, `components/directoryiq/**` (readability/palette only)

## Route Coverage

| Route | Background/Card Treatment | Contrast Status | Drift Notes |
| --- | --- | --- | --- |
| `/directoryiq` | iBrains shell + light cards | Good | Dashboard already mostly normalized |
| `/directoryiq/listings` | Mixed light shell with dark legacy table utilities | Partial | `text-slate-*` + `bg-slate-*` classes still reduced readability |
| `/directoryiq/listings/[listingId]` | Hero + deep workflow surfaces still legacy dark/cyan class stack | Needs normalization | Highest concentration of `bg-slate-*`, `text-slate-*`, `border-white/*`, `bg-cyan-*` |
| `/directoryiq/authority` | Legacy dark utility classes | Needs normalization | Section cards and copy too low-contrast |
| `/directoryiq/authority/blogs` | Legacy dark utility classes | Needs normalization | Table, detail panel, filters all standalone style |
| `/directoryiq/authority/listings` | Legacy dark utility classes | Needs normalization | Table + side panel styling drift |
| `/directoryiq/graph-integrity` | Legacy dark utility classes | Needs normalization | Metrics and table had low-contrast text |
| `/directoryiq/signal-sources` | Legacy dark utility classes | Needs normalization | Inputs/cards/headings low-contrast on light shell |
| `/directoryiq/settings` | Legacy dark utility classes | Needs normalization | Form controls used dark palette |
| `/directoryiq/settings/integrations` | Inherits settings styling | Needs normalization | Same as settings |
| `/directoryiq/versions` | Mixed light shell + dark utility classes | Needs normalization | Version cards/text contrast drift |

## Root Cause

DirectoryIQ pages were migrated functionally, but many route-local components retained standalone utility classes:

- text: `text-slate-100/200/300/400/500`, `text-cyan-100/200`, `text-emerald-100`, `text-rose-100`, `text-amber-100`
- surfaces: `bg-slate-950*`, `bg-slate-900*`, `bg-black/*`, `bg-white/[0.0x]`
- borders/rings: `border-white/*`, `border-cyan-*`, `ring-cyan-*`

Those classes were authored for a dark standalone context and produced low contrast in the light iBrains shell.

## Normalization Strategy

1. Apply a scoped global normalization under `.directoryiq-app-theme` in `app/globals.css`.
2. Remap legacy dark/cyan utility classes to iBrains light tokens.
3. Keep scope constrained to `/directoryiq/**` via the existing layout wrapper.
4. Add targeted component-level corrections where global remap is not enough:
   - `signal-sources` section headings
   - authority sub-nav active/inactive tabs
   - listing hero surface and chip palette

## Safety Checks

- No `/brains/**` files targeted.
- No PageBolt files targeted.
- No API/data/schema changes in this lane.
