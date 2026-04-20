# SiteForge Thrive-Native Blueprint (Premier, Safe-Mode First)

## 1) Current Control Surface (Production-Safe)
Production writes remain constrained to proven WordPress endpoints:
- `/wp-json/wp/v2/pages`
- `/wp-json/wp/v2/settings`
- existing menu flows already used by SiteForge

Thrive endpoints stay read-only in production. SiteForge does not perform blind `ttb/v1`, `tcb/v1`, or generic Thrive CPT write mutations in runtime safe mode.

## 2) Known Thrive-Native Primitives (Grounded)
From safe GET discovery and live reverse-engineering:
- Theme shell: active skin (`thrive_skin_tax`)
- Reusable Architect blocks: `tcb_symbol`
- Theme Builder primitives: `thrive_template`, `thrive_layout`, `thrive_section` counts/inventory hints

SiteForge normalizes symbol intelligence into:
- identity: `id`, `title`, `slug`, taxonomy
- inferred role: `header | footer | section | unknown`
- reusability and payload signals: builder payload present, custom CSS present
- lightweight fingerprints: `contentHash`, `cssHash`, token keywords

## 3) What SiteForge Now Understands
SiteForge now reasons in Thrive-native planning terms while keeping execution safe:
- page role (`homepage`, `about`, `contact`, `faq`, `features`, `pricing`, `generic`)
- shell role (`homepage_shell`, `standard_shell`, `conversion_shell`, `utility_shell`)
- section intent (`conversion`, `informational`, `trust`, `navigation`)
- symbol candidate type (`header`, `footer`, `cta`, `testimonial`, `faq`, `marketing`, `generic`)
- preferred render target (`thrive_symbol_reference`, `thrive_content_template_reference`, `future_landing_page_candidate`, `wp_html_fallback`, etc.)

Resolver output is persisted as section-resolution intelligence:
- chosen resolution tier (`existing_symbol`, `existing_content_template`, `future_landing_page_candidate`, `wp_html_fallback`)
- matched symbol id/title/role (if any)
- confidence and explicit reasons/rejections

## 4) Safe-Mode Symbol Reuse Strategy
Deterministic matching order:
1. existing symbol (`tcb_symbol`)
2. existing content-template candidate (if safely discoverable)
3. future landing-page candidate
4. WordPress HTML fallback

This makes SiteForge Thrive-first in planning/reuse without introducing risky runtime mutations.

## 5) Staging-Native Harness (Disabled by Default)
SiteForge now includes a staging-only native harness interface with hard guards:
- Feature flag required: `SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING=1`
- Must not run in production
- Requires explicit staging marker + route allowlist + schema contract version
- Blocks live iPetzo-like hosts
- Emits auditable logs for attempted native operations

Stubs/interfaces now exist for:
- `assignTemplateToPost()`
- `createOrUpdateThriveSymbol()`
- `createOrUpdateThriveSection()`
- `importArchitectContentArtifact()`
- `importThemeBuilderArtifact()`

## 6) Artifact-First Future Boundary
Future native composition should use artifact boundaries rather than opaque endpoint fuzzing:
- Theme Builder export bundle
- Architect content export bundle
- Landing page export bundle
- Design Pack import/export bundle

Planned references in contracts:
- `themeArtifactRef`
- `architectContentArtifactRef`
- `landingPageArtifactRef`
- `designPackArtifactRef`

## 7) Staged Promotion Flow
1. Live site inspection (strict read-only)
2. Build Thrive intelligence manifests and section-resolution maps
3. Prepare artifacts in staging
4. Validate schema contracts and invariants
5. Import/promote with audit trail
6. Never fuzz live opaque Thrive write endpoints

## 8) Explicitly Off-Limits in Production
- Blind writes to `ttb/v1/*` or `tcb/v1/*`
- Generic Thrive CPT mutation without staging contracts
- Unbounded builder blob rewriting

This keeps production deterministic and safe while moving SiteForge toward true Thrive-native depth.
