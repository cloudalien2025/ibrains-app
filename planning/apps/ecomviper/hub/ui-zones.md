# EcomViper Hub UI Zones

This document describes conceptual UI zones.
It does not implement routes or UI in this sprint.

## Private Hub Control Plane Zones (`app.ibrains.ai/apps/ecomviper/hub`)

### Hub Overview Dashboard

Top-level control-plane summary for feed health, canonical quality, publication posture, trust posture, queue pressure, and high-priority actions.

### Feed Control Center

Zone for feed intake monitoring, validation diagnostics, freshness status, and replay/recovery controls.
Sprint 005 seeds this zone in private Hub as static/demo cards, source table, and queue previews.

### Canonical Product Manager

Zone for canonical entity inspection, mapping evidence, conflict review, and merge decision workflows.

### Public Visibility Center

Zone for visibility policy, public eligibility status, and publication governance across canonical products.

### Publication Queue

Queue for approve/publish/suppress/unpublish decisions with audit and trust context.

### Canonical Product Publishing Review

Review workspace for validating public-safe fields, public slug readiness, and publication checks before release.

### Marketplace Routing Center

Zone for routing decisions, destination queues, dispatch posture, and execution gate states.

### Marketplace Offer Routing Review

Review panel for approved offer eligibility and route-to-marketplace behavior before public exposure.

### Agentic Visibility Center

Zone for semantic coverage, retrieval/selection readiness diagnostics, and visibility-driven remediation actions.

### Trust & Verification Review

Zone for trust signals, verification status, compliance escalation, and suppression gating.

### Public Analytics / Attribution Panel

Zone for public discovery and routing attribution metrics fed back into private Hub operations.

### Public Page Preview

Preview panel for public-safe canonical page representations prior to publication.

### Unpublish / Suppression Controls

Operational controls for rollback, unpublish, and suppression with required audit rationale.

### Audit / Event Timeline

Zone for immutable timeline of ingestion, merge, publication, routing, review, and override events.

### Queue / Review Panels

Cross-zone queue surfaces for unresolved conflicts, high-risk trust items, and action approvals.

### Intelligence Cards

Composable card surfaces for canonical quality, trust signals, semantic gaps, routing opportunity clusters, and publication readiness.

### Domain / Publication Status Panel

Optional control-plane panel for domain/publication routing posture and publication infrastructure state visibility.

## Public-Facing Page Families (`ecomviper.com`, conceptual)

### Public Product Pages

Canonical product pages exposed after approval.

### Public Search / Discovery

Public search and semantic discovery surfaces over approved canonical intelligence.

### Category Pages

Discovery pages grouped by canonical categories.

### Brand Pages

Discovery pages grouped by canonical brands.

### Use-Case Pages

Discovery pages organized by use-case intent clusters.

### Comparison Pages

Structured comparison pages based on approved canonical facts.

### Verified / Trust Pages

Public trust and verification surfaces derived from approved trust state.

## Navigation Philosophy

Navigation should be control-plane first:

- summarize health and priorities quickly
- route operators into queue-first workflows
- keep canonical context visible while entering publication/routing decisions
- separate diagnostics from execution actions with explicit gate states
- keep public preview/release controls explicit and auditable
