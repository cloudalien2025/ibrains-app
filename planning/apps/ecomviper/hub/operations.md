# EcomViper Hub Operations

## Reliability Expectations

Hub should provide deterministic, auditable workflow behavior for ingestion, canonical mapping, publication approvals, and routing decisions.
Operators should be able to understand current state and failure reasons without inspecting raw internals.

## Public / Private Data Separation

Operational controls must enforce strict data boundaries between:

- private control-plane data at `app.ibrains.ai/ecomviper/hub`
- public-safe published data at `ecomviper.com`

Private merchant/operator fields must never be exposed on public Hub.

## Auditability

Core operational actions should be traceable:

- feed submission outcomes
- canonical match/merge decisions
- visibility/publication approvals
- publish/unpublish/suppression actions
- routing decisions and overrides
- queue transitions

Audit records should preserve actor, timestamp, reason, and relevant evidence pointers.

## Observability

Operational observability should include:

- feed health status and error families
- queue depth and aging
- merge conflict rates
- publication queue outcomes
- public page freshness and marketplace offer freshness
- routing outcome summaries
- visibility/trust signal trend movement
- public analytics and attribution loop health

## Sync Health

Hub should expose channel sync posture and freshness by source.
Stale or failed sync paths should be clearly surfaced and linked to remediation workflows before public publication.

## Publication Approvals

Publication should remain approval-gated.
Approval controls should verify:

- canonical match confidence and conflict state
- trust/compliance readiness
- public/private field classification
- routing safety constraints

## Rollback, Unpublish, And Suppression

Operations should include controlled recovery paths:

- rollback publication state after incorrect publish
- unpublish/suppress canonical product pages
- pause routing exposure when trust/compliance risk increases

Every reversal action should emit publication audit events.

## Failure Handling

Failure handling should be family-based:

- validation failures
- mapping/conflict failures
- publication failures
- routing dispatch failures
- integration connectivity failures
- trust/compliance escalation blocks

Each family should map to smallest-scope recovery actions and replay paths.

## Manual Review Needs

Manual review should be mandatory for low-confidence merge decisions, high-risk trust signals, and high-impact routing/publication actions.
Review controls should support approve/reject/edit with explicit rationale logging.

## Data Quality Safeguards

Quality safeguards should include:

- source provenance requirements
- confidence thresholds for auto-merge versus manual review
- conflict detection and unresolved conflict queueing
- drift detection between canonical and channel mappings
- pre-publication quality checks for public-safe summaries and schema metadata

## Public Page And Offer Freshness

Hub should monitor:

- public canonical page freshness
- marketplace offer freshness and routing validity
- stale publication states requiring reapproval or suppression

## Routing Accuracy

Routing integrity should be monitored against:

- approved routing policy
- offer eligibility drift
- trust/compliance state changes
- attribution outcome quality

## Trust / Compliance Review

Trust and compliance workflows should gate publication and routing exposure.
Escalations should be explicit, auditable, and reversible.

## SEO / Schema Monitoring

Public Hub should include monitoring for:

- schema generation health
- structured metadata consistency
- public discovery/indexing anomalies

This sprint defines operations guidance only; it does not implement schema pipelines.

## Domain And Hosting Operations Considerations

Operational ownership should include:

- hostname/domain routing governance between `ecomviper.com`, `ibrains.ai`, and `app.ibrains.ai`
- SSL/certificate ownership and renewal accountability
- separation criteria for moving `ecomviper.com` to dedicated infrastructure

Current architecture decision does not require a separate DigitalOcean droplet yet.

## Future Deployment Separation Criteria

Potential triggers for public deployment separation include:

- sustained public traffic pressure
- stricter security isolation requirements
- SEO/public performance constraints
- independent release cadence needs

## Operational Dashboards

Future private Hub operations dashboards should prioritize:

- ingestion reliability
- canonical quality and conflict pressure
- publication queue and approval posture
- trust risk posture
- queue throughput and backlog
- routing effectiveness
- public analytics/attribution loop quality

## Future Monitoring Needs

1. SLOs for feed intake, publication queue, and routing processing
2. Alerting for trust-risk spikes, suppression triggers, and conflict backlog
3. Instrumentation for recommendation-to-outcome loop quality
4. Capacity monitoring for growth in channels, canonical entities, and public traffic
