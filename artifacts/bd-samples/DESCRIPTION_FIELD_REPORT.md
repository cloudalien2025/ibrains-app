# DESCRIPTION_FIELD_REPORT

## Execution status (March 1, 2026)

- Attempted script: `node scripts/capture_bd_evidence_reports.mjs`
- Attempted with `.env` and `/etc/ibrains/ibrains-app.env` loaded.
- Blocking error:
  - `getaddrinfo EAI_AGAIN ibrains-postgres-do-user-16196091-0.k.db.ondigitalocean.com`

## Result

- Exact BD description field for `user_id=3` could not be round-trip verified in this sandbox due outbound DNS/network resolution failure to the configured Postgres host.
- Push route now resolves candidate fields deterministically in this order:
  - `group_desc`
  - `description`
  - `short_description`
  - `post_body`
  - `about_me`
  - `bio`
