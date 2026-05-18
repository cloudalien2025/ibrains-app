# EcomViper Hub Workflows

## Private Shell Foundation Status

Sprint 005 seeds static/demo Feed Control Center content in private Hub (`/apps/ecomviper/hub`) to represent intake posture from Walmart/eBay/Amazon/Shopify.
No live sync or API-driven workflow execution is implemented in this sprint.

## Optimized Feed Sync From Marketplace Apps Into Private Hub

1. Merchant optimizes listings/feeds in Walmart, Shopify, eBay, Amazon, or future channel apps
2. Optimized feed package syncs into private Hub (`app.ibrains.ai/apps/ecomviper/hub`)
3. Intake validates payload shape and source metadata
4. Submission is accepted, rejected, or queued for manual review

## Marketplace Feed Intake

1. Channel feed enters intake queue
2. Validation and classification run
3. Feed records are normalized into candidate mapping payloads
4. Failures route to recovery queue with error families

## Canonical Product Creation / Matching

1. Candidate records are evaluated against canonical identifiers and attributes
2. Match confidence and conflict reasons are computed
3. Candidate maps to existing canonical product or triggers canonical create review
4. Canonical record remains pending publication until visibility/trust checks pass

## Canonical Merge Review

1. Merge proposal is generated with evidence/provenance
2. Operator reviews merge changes and trust implications
3. Operator approves, edits, or rejects proposal
4. Decision is logged with audit event

## Public Visibility Approval Workflow

1. Canonical product enters visibility review queue
2. Operator verifies public/private field classification
3. Operator validates trust/compliance state and routing policy
4. Operator sets visibility and publication eligibility status

## Public Canonical Page Publication To `ecomviper.com`

1. Publication-eligible canonical record enters publication queue
2. Public-safe projection is generated and validated
3. Operator approves publish action
4. Canonical page is marked eligible for public Hub exposure at `ecomviper.com`

## Public Route-To-Marketplace Offer Workflow

1. Approved marketplace offers are selected per routing policy
2. Public discovery surfaces expose route-to-marketplace pathways
3. Routing outcomes and safety checks are tracked for review

## Agentic Visibility Review

1. Visibility diagnostics aggregate semantic, trust, and retrieval signals
2. Gaps and opportunities are ranked
3. Operator confirms recommended remediation path
4. Follow-up routing items are created

## Public Analytics Feedback Into Private Hub

1. Public discovery/routing events are collected
2. Attribution is mapped back to canonical products and routing decisions
3. Private Hub dashboards update signal quality and routing confidence
4. Operators adjust publication/routing policy as needed

## Trust / Compliance Escalation Before Publication

1. Trust/compliance issues trigger escalation queue items
2. Publication state is blocked or downgraded pending review
3. Operator resolves, suppresses, or rejects publication candidate
4. Resolution is logged in publication audit events

## Unpublish / Suppression Workflow

1. Risk signal, policy change, or quality issue triggers suppression review
2. Operator executes unpublish/suppress action
3. Public surface is updated to remove or restrict exposure
4. Audit timeline records actor, reason, and recovery requirements

## Escalation And Recovery Workflows

1. Intake, merge, publication, or routing failures trigger escalation queue items
2. Errors are grouped by failure family
3. Operators apply smallest-scope remediation
4. Replay/retry decisions are logged

## Manual Review Workflows

Manual review is required for:

- low-confidence canonical matches
- trust/compliance conflicts
- high-impact publication decisions
- high-impact routing actions
- unresolved source inconsistencies

Manual decisions should always create explicit audit events and confidence updates.

## Future Infrastructure Transition Workflow (Conceptual)

If `ecomviper.com` requires separation from shared app infrastructure:

1. Trigger criteria (traffic/security/SEO/scaling/release cadence) is validated
2. Deployment target options are evaluated
3. Publication pipeline cutover plan is approved
4. Migration executes with rollback and audit controls

This is a future operational workflow definition only.
No DNS, SSL, droplet, or hosting changes are implemented in this sprint.
