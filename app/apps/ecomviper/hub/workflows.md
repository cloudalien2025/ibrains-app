# EcomViper Hub Workflows

## Merchant Feed Submission

1. Merchant/channel system submits feed package
2. Intake validates payload shape and source metadata
3. Feed is accepted, rejected, or queued for review
4. Submission status and diagnostics are recorded

## Marketplace Feed Intake

1. Channel feed enters intake queue
2. Validation and classification run
3. Feed records are normalized into candidate mapping payloads
4. Failures route to recovery queue with error families

## Canonical Product Matching

1. Candidate records evaluated against canonical identifiers and attributes
2. Match confidence and conflict reasons computed
3. Candidate mapped to existing canonical product or flagged for new canonical creation

## Canonical Merge Review

1. Merge proposal generated with evidence/provenance
2. Operator reviews changes and trust implications
3. Operator approves, edits, or rejects proposal
4. Decision is logged with audit event

## Marketplace Offer Routing

1. Canonical insight emits routing candidate
2. Priority and destination channel determined
3. Execution posture assigned (`manual_review`, `ready_for_dispatch`, `blocked`)
4. Action pushed to destination queue

## Agentic Visibility Review

1. Visibility diagnostics aggregate semantic, trust, and retrieval signals
2. Gaps and opportunities are ranked
3. Operator confirms recommended remediation path
4. Follow-up routing items are created

## Optimization Feedback Loop Into Marketplace Apps

1. Hub recommendations are exported to channel-specific workflows
2. Channel outcomes (success/failure/warning) return to Hub
3. Outcome telemetry updates signal quality and routing confidence

## Escalation And Recovery Workflows

1. Intake or merge failures trigger escalation queue items
2. Errors are grouped by failure family
3. Operators apply smallest-scope remediation
4. Replay/retry decisions are logged

## Manual Review Workflows

Manual review is required for:

- low-confidence canonical matches
- trust/compliance conflicts
- high-impact routing actions
- unresolved source inconsistencies

Manual decisions should always create explicit audit events and confidence updates.
