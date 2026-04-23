# DirectoryIQ to iBrains Token Mapping

Date: 2026-04-23

## Canonical iBrains Palette Used

- App background: `#F4F8FC`
- Card background: `#FFFFFF` / `#FFFFFFF2`
- Hairline border: `#D9E4F0`
- Primary text: `#0F172A`
- Secondary text: `#334155`
- Muted text: `#64748B`
- Primary action: `#2563EB` (`hover #1D4ED8`)
- Soft primary tint: `#DBEAFE`

## Legacy Class Remapping (Scoped to `.directoryiq-app-theme`)

| Legacy utility family | iBrains-aligned result |
| --- | --- |
| `text-slate-100/200/300/400/500` | `#0F172A / #1E293B / #334155 / #64748B` |
| `text-cyan-*`, `text-indigo-100` | primary link tone `#1D4ED8` |
| `text-emerald-100/200` | readable success text `#047857` |
| `text-rose-100/200` | readable error text `#BE123C` |
| `text-amber-100/200`, `text-orange-100` | readable warning text `#A16207` |
| `bg-slate-950*`, `bg-slate-900*`, `bg-black/*` | near-white card/surface overlays |
| `bg-white/[0.02-0.04]`, `bg-white/5` | soft iBrains card tint |
| `bg-cyan-400/*` | soft blue action tint |
| `border-white/*` | iBrains hairline `#D9E4F0` |
| `ring-cyan-300/40` | iBrains blue focus ring |

## Targeted Component Overrides

- `app/apps/directoryiq/signal-sources/directoryiq-signal-sources-client.tsx`
  - Elevated section headings to high-contrast text.
- `app/apps/directoryiq/authority/_components/authority-section-nav.tsx`
  - Active/inactive tab styles aligned to iBrains button/nav treatment.
- `components/directoryiq/ListingHero.tsx`
  - Hero panel, gradients, chip tones, and text adapted to iBrains readability.
