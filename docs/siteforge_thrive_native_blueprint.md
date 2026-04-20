# SiteForge Thrive-Native Blueprint (Staging Composer + Validation v1)

## 1) Current Truth
SiteForge now operates in four explicit runtime states:
- `wp_safe_mode`
- `thrive_intel_mode`
- `thrive_native_staging_mode`
- `blocked_native_mode`

Production remains constrained to safe WordPress write surfaces:
- `/wp-json/wp/v2/pages`
- `/wp-json/wp/v2/settings`
- existing menu endpoints already used by SiteForge

## 2) Staging-Native Contract Registry (v1)
SiteForge now uses an explicit operation registry (`lib/siteforge/thriveNativeContracts.ts`) for every native staging write.

Each operation contract defines:
- operation name
- endpoint/mechanism
- method
- required payload fields
- expected response shape
- object type
- verification method
- rollback support
- allowed environments
- payload fingerprinting (`sha256_json`)

### v1 Operation Set
- `assignTemplateToPost`
- `createOrUpdateSymbol`
- `createOrUpdateSection`
- `createOrUpdateTemplateShellReference`
- `attachReusablePrimitiveToPagePlan`
- `importArchitectContentArtifact` (placeholder)
- `importThemeBuilderArtifact` (placeholder)

No staging-native operation executes unless:
1. staging guard is eligible
2. operation is contract-defined
3. operation is allowlisted
4. payload passes required-field validation
5. verification strategy exists

## 3) Staging Guard Model
Guard inputs:
- `SITEFORGE_ENABLE_THRIVE_NATIVE_STAGING=1`
- `SITEFORGE_THRIVE_STAGING_MARKER=staging`
- `SITEFORGE_THRIVE_SCHEMA_CONTRACT_VERSION`
- `SITEFORGE_THRIVE_ROUTE_ALLOWLIST`
- optional `SITEFORGE_THRIVE_NATIVE_OPERATION_ALLOWLIST`

Hard blocks:
- production environment
- invalid/missing staging marker
- missing schema contract version
- missing allowlisted operation set
- live host patterns (including `ipetzo`)

## 4) Native Composer v1 Scope
The composer (`lib/siteforge/thriveNativeComposer.ts`) is intentionally narrow and deterministic.

### Supported v1 section scope
- homepage shell targeting
- hero
- CTA
- features
- FAQ
- testimonials
- header/footer reuse flow

### Resolution priority
1. reuse existing primitive (`attachReusablePrimitiveToPagePlan`)
2. create minimal native object (`createOrUpdateSymbol` or `createOrUpdateSection`)
3. safe fallback / blocked states

Each section is labeled as one of:
- `reused_existing`
- `created_native`
- `wp_fallback`
- `blocked_by_guard`
- `blocked_by_missing_contract`

## 5) Native Execution, Verification, Audit, Rollback
Execution layer (`lib/siteforge/thriveNativeHarness.ts`) now:
- validates guard + allowlist + contract + payload
- executes approved operation
- fingerprints payload
- verifies result (`response_fields`, `read_back`, or logical)
- records step-level audit metadata

Stored step metadata includes:
- endpoint
- method
- object type
- target id
- payload hash
- success/verification flags
- rollback readiness

Rollback model (v1):
- tracks created native objects per run
- exposes delete rollback steps for supported object types
- executes deterministic cleanup on explicit rollback call

## 6) Native Validation Runner (Dry-Run + Real-Run)
SiteForge now includes a dedicated staging validation runner (`lib/siteforge/thriveNativeValidation.ts`).

Validation modes:
- `dry_run`: compose + guard + precheck + homepage state checks, no native writes
- `real_run`: execute contract-approved native operations in staging, verify state, optionally roll back created objects

Per-section outcomes are explicitly classified as:
- `reused_existing`
- `created_native`
- `wp_fallback`
- `verification_failed`
- `blocked_by_guard`
- `blocked_by_missing_contract`

Run-level validation captures:
- guard status and plan mode
- step verification aggregation
- homepage identity/reachability checks
- created object state checks
- rollback verification status when executed
- promotion-candidate summary

## 7) Workspace / Session Truth
SiteForge persists native staging metadata in run/snapshot truth:
- `thrive.nativeGuard`
- `thrive.nativeComposition`
- `thrive.nativeExecution`
- `thrive.nativeValidation`
- section resolution details
- runtime mode summary and current mode

This gives deterministic replay/debug and a clear contract-capture history for each run.

## 8) UI / Product Surface
SiteForge workspace now exposes a dedicated native staging control surface:
- guard eligibility and block reason
- allowlisted operation set
- schema contract version
- composition summary (reuse/create/fallback/block)
- step-level execution + verification
- rollback/reset availability
- native validation mode/status
- per-section validation outcomes
- promotion candidate readiness and reason

## 9) Artifact Capture and Promotion Path
Validation runs now persist a promotion-candidate summary with:
- run fingerprint
- environment marker
- target page id
- reused symbol ids
- object ids
- payload hashes
- verification snapshot
- rollback snapshot
- nullable artifact references:
  - `themeArtifactRef`
  - `architectContentArtifactRef`
  - `landingPageArtifactRef`
  - `designPackArtifactRef`
  - `contractCaptureRef`

Future promotion flow remains:
1. compose in staging
2. verify
3. capture stable object graph/artifacts
4. promote intentionally
5. never fuzz opaque live endpoints

## 10) Explicit Off-Limits
Still off-limits for production:
- blind writes to `ttb/v1/*` and `tcb/v1/*`
- generic Thrive CPT mutation without guard + contract + allowlist
- unconstrained builder blob rewrites

This keeps production safe while enabling real Thrive-native authoring in staging.
