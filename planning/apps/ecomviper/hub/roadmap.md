# EcomViper Hub Roadmap

This roadmap is architecture and planning guidance.
It does not implement public routes, WordPress changes, DNS, SSL, droplets, or hosting changes in this sprint.

## Phase 0: Architecture Foundation

### Goals

- Establish Hub intent, architecture language, and boundary definitions
- Align canonical-first operating model across future sprints

### Likely Deliverables

- Hub architecture/planning foundation in `planning/apps/ecomviper/hub/`
- Initial phased implementation plan

### Non-Goals / Deferrals

- No public/private route implementation
- No persistence or API implementation

## Phase 1: Private Hub Shell And Navigation

### Goals

- Establish private Hub shell at `/ecomviper/hub`
- Make Hub discoverable inside EcomViper app navigation

### Likely Deliverables

- Private control-plane shell and static workspace sections
- Planning-aligned command-center framing

### Non-Goals / Deferrals

- No public Hub surface implementation
- No deep integrations or live ingestion

## Phase 2: Public Surface Architecture And Publication Boundary

### Goals

- Formalize public/private surface model
- Define publication boundary from private Hub to public Hub
- Confirm preferred public domain direction (`ecomviper.com`)

### Likely Deliverables

- Public/private data boundary contracts
- Publication eligibility and approval lifecycle definitions
- Public URL family concepts

### Non-Goals / Deferrals

- No public route implementation
- No DNS/SSL/hosting cutover

## Phase 3: Canonical Feed Aggregation (Private Hub)

### Goals

- Define typed feed intake contracts for selected channels
- Build intake validation/status/review foundations in private Hub

### Likely Deliverables

- Feed submission/read contracts
- Intake status views and failure diagnostics

### Non-Goals / Deferrals

- No broad marketplace write automation
- No complete canonical merge automation

## Phase 4: Canonical Product Graph And Publishing Eligibility

### Goals

- Introduce canonical product entity lifecycle
- Support identifier matching, confidence, and conflict states
- Add publication eligibility modeling for public-safe outputs

### Likely Deliverables

- Canonical product and mapping models
- Merge/review queue concepts with operator controls
- Publication status and public-safe projection model

### Non-Goals / Deferrals

- No full graph optimization engine
- No bulk public publishing automation

## Phase 5: Public Hub Shell On `ecomviper.com`

### Goals

- Launch first public Hub shell on preferred public surface
- Serve approved canonical intelligence only

### Likely Deliverables

- Public shell and foundational navigation
- Public product/discovery placeholders with approved data boundary

### Non-Goals / Deferrals

- No exposure of private merchant/operator data
- No full content/search feature parity on first public release

## Phase 6: Approved Canonical Product Pages And Discovery Families

### Goals

- Publish approved canonical product pages
- Expand public discovery surfaces across categories/brands/use-cases/comparisons

### Likely Deliverables

- Product pages (`/products/{slug}`)
- Discovery pages (`/search`, `/categories/{slug}`, `/brands/{slug}`, `/use-cases/{slug}`)
- Verified/trust public surfaces (`/verified`)

### Non-Goals / Deferrals

- No unlimited automatic publishing without approval controls
- No unrelated marketplace workflow rewrites

## Phase 7: Trust, Routing, And AI-Readable Metadata

### Goals

- Strengthen trust/verification and marketplace routing intelligence
- Publish structured metadata for AI/search readability

### Likely Deliverables

- Public trust markers and verification summaries
- Structured metadata/schema guidance and rollout
- Public-to-marketplace routing controls

### Non-Goals / Deferrals

- No opaque or unreviewed routing decisions
- No replacement of channel-native compliance programs

## Phase 8: Public Analytics And Attribution Feedback Loop

### Goals

- Capture public discovery/routing performance
- Feed attribution and outcome signals back into private Hub control plane

### Likely Deliverables

- Public analytics event model
- Attribution loop dashboards/panels in private Hub
- Optimization feedback contracts to marketplace apps

### Non-Goals / Deferrals

- No broad marketing analytics platform rebuild
- No uncontrolled tracking outside governance boundaries

## Phase 9: Optional Infrastructure Separation

### Goals

- Evaluate separation of public Hub deployment from shared app infrastructure if required

### Likely Deliverables

- Decision criteria for traffic isolation, security boundaries, SEO/public performance, scaling, and release cadence
- Migration plan options (dedicated app platform/edge/host)

### Non-Goals / Deferrals

- No mandatory separate DigitalOcean droplet at this stage
- No immediate infrastructure split unless justified by operational criteria
