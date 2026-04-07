# iPetzo Contract Lock v1

## Purpose and scope
This document freezes Contract Lock v1 for iPetzo integration from the iBrains side.

This is a contract freeze, not an implementation document.

## Locked role of iBrains in the iPetzo system
iBrains is the reusable knowledge layer behind Cosmo.

iBrains receives normalized context from the orchestrator and returns grounded advisory support and enrichment results.

## What iBrains owns
- global pet-care knowledge
- species and breed expertise
- retrieval
- context assembly
- grounded advisory support
- enrichment results

## What iBrains explicitly does NOT own
- pet CRUD
- village operational memory
- reminders, meds, and vaccine event logs
- household raw truth
- direct mobile app traffic

## Accepted upstream contract assumptions
- Orchestrator is the caller, not mobile.
- Requests arrive as normalized app-domain context, not raw app internals sprayed into brain storage.
- Enrichment is server-side and controlled.

## Boundary between operational memory and reusable brain knowledge
Operational memory stays in iPetzo systems and carries household and pet-specific truth.

Reusable brain knowledge stays in iBrains and carries generalized pet-care expertise.

Village anecdotes never become global expertise by default.

## Safety and grounding expectations
- grounded answers only
- uncertainty is preserved
- weak evidence can downgrade confidence or refuse
- village anecdotes never promote to global expertise

## Open decisions not locked by this doc
- datastore selection
- stable brain slug
- taxonomy namespace
- approved external source policy
- citation visibility policy
- stronger-confirmation fact classes
- first-phase supported ask set

## Next implementation lane note
The first implementation lane is basic app -> orchestrator -> brain Ask Cosmo.

This contract remains source-of-truth until explicitly revised.
