# Planning Questions

Last updated: 2026-05-18 (UTC)

## Open Questions

### Should every app maintain `overview.md` + `product-intent.md` as a required pair?
Owner: Architecture
Status: Open
Notes: Current structure suggests yes, but enforcement rules are not yet explicit for very small or placeholder app surfaces.

### Should every major sprint require the four-file sprint pack pattern?
Owner: Architecture
Status: Open
Notes: Pattern is useful for larger scope; threshold for "major sprint" needs explicit definition.

### What is the canonical naming policy for app families, workspaces, command centers, and agents?
Owner: Architecture + Product
Status: Open
Notes: Legacy naming drift remains in some implementations; policy should define current labels and legacy alias handling.

### Which app surfaces still require implementation-derived product-intent sprints?
Owner: Planning
Status: Open
Notes: SiteForge and Amazon remain likely candidates for deeper implementation-derived intent baselines.

### Which planning docs are mandatory versus optional for small sprints?
Owner: Architecture
Status: Open
Notes: Need explicit minimum doc set for low-risk docs-only or bugfix sprints.

### Should Prompt Match, Semantic Gaps, and Product Opportunities remain mapped to Activity/Inventory/Pricing, or get dedicated workflows?
Owner: Walmart Product + UX
Status: Open
Notes: Current nav labels and route responsibilities are intentionally mapped but not semantically one-to-one, which may affect operator expectations and sprint scoping.

### Which AI visibility signals should be production-backed first?
Owner: Walmart Product + Engineering
Status: Open
Notes: Candidate priorities from implementation evidence include prompt/query evidence, queue state transitions, and durable activity/feed visibility timelines.

## Closed Questions

### Which Walmart AI visibility score is canonical across Command Center, Product Editor, and iBrains Intelligence?
Owner: Walmart Product + Architecture
Status: Closed (resolved in docs contract)
Resolution: Canonical vocabulary and ownership are now defined in `planning/apps/ecomviper/walmart/score-contract.md`. The top-level rollup is constrained to command-center readiness (`overallAiRecommendationReadinessScore`) while product editor and iBrains scores are documented as component/diagnostic scopes.

### Which API payload should expose the canonical Walmart `ai_visibility_score` first?
Owner: Walmart Product + Architecture
Status: Closed (resolved in docs contract)
Resolution: First canonical API payload boundary is documented in `planning/apps/ecomviper/walmart/ai-visibility-api-boundary.md` with `/api/ecomviper/walmart/health` as the initial additive host route for `ai_visibility_score`.
