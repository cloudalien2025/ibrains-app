# EcomViper Hub Roadmap

## Phase 0: Architecture Foundation

### Goals

- Establish Hub intent, architecture language, and boundary definitions
- Align canonical-first operating model across future sprints

### Likely Deliverables

- Hub architecture markdown foundation in app folder
- Initial phased implementation plan

### Non-Goals / Deferrals

- No runtime route/UI implementation
- No persistence or API implementation

## Phase 1: App Shell And Navigation Entry

### Goals

- Add first app shell for `/apps/ecomviper/hub`
- Make Hub discoverable inside EcomViper app navigation

### Likely Deliverables

- Route scaffold and top-level hub landing page
- Basic nav card/entry alignment with EcomViper family

### Non-Goals / Deferrals

- No full dashboard intelligence features
- No deep integrations

## Phase 2: Canonical Feed Aggregation

### Goals

- Define typed feed intake contracts for selected channels
- Build basic ingestion + validation + queueing foundation

### Likely Deliverables

- Feed submission/read contracts
- Intake status views and failure diagnostics

### Non-Goals / Deferrals

- No broad marketplace write automation
- No complete canonical merge automation

## Phase 3: Canonical Product Graph

### Goals

- Introduce canonical product entity lifecycle
- Support identifier matching, confidence, and conflict states

### Likely Deliverables

- Canonical product and mapping models
- Merge/review queue concepts with operator controls

### Non-Goals / Deferrals

- No full graph optimization engine
- No advanced recommendation ranking yet

## Phase 4: Marketplace Routing Layer

### Goals

- Route prioritized actions from canonical signals to channel destinations
- Formalize manual vs automated routing gates

### Likely Deliverables

- Routing decision objects and action queue model
- Initial outbound routing workflow surfaces

### Non-Goals / Deferrals

- No full auto-execution across all channels
- No deep SLA automation

## Phase 5: Agentic Visibility Center

### Goals

- Provide unified visibility diagnostics for answer-engine and agentic commerce readiness
- Link diagnostics to actionable queue items

### Likely Deliverables

- Visibility cards, diagnostic views, and remediation queue concepts
- Shared score language alignment across Hub and channel apps

### Non-Goals / Deferrals

- No guaranteed external attribution integrations yet
- No universal score formulas across every channel signal

## Phase 6: AI-Native Discovery And APIs

### Goals

- Expose stable intelligence APIs for internal agents and services
- Support semantic discovery and retrieval-oriented use cases

### Likely Deliverables

- API contracts for canonical entities, routing context, and trust evidence
- Queryable discovery surfaces for internal consumers

### Non-Goals / Deferrals

- No public marketplace API commitments
- No uncontrolled autonomous mutation paths

## Phase 7: Trust Verification And Recommendation Systems

### Goals

- Expand trust, verification, and recommendation quality systems
- Strengthen review controls and measurable recommendation outcomes

### Likely Deliverables

- Trust signal aggregation and verification workflows
- Recommendation evaluation and governance model

### Non-Goals / Deferrals

- No replacement of all channel-native trust programs
- No fully autonomous end-to-end orchestration without human oversight
