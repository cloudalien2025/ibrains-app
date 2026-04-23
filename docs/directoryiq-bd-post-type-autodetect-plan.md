# DirectoryIQ BD Post Type Auto-Detect Plan

## 1) Chosen Auto-Detect Strategy
- Primary strategy: deterministic API probing using only configured `base_url` + `api_key`.
- Step A: enumerate data categories through BD API candidates:
  - `/api/v2/data_categories/search`
  - `/api/v2/data_category/search`
  - `/api/v2/data_categories/list`
  - `/api/v2/data_category/list`
- Step B: build candidate IDs from category records and from search-response hints.
- Step C: verify candidates with real endpoint behavior:
  - Listings: call configured listings search path with `data_id`, require listing-like rows.
  - Blog: call data-posts search paths with `data_id`, require blog-like rows.
- Step D: persist detected IDs to the site record when verification is successful.

## 2) Fallback Strategy
- If category enumeration does not return usable records:
  - probe IDs hinted in payload fields (`data_id`, `category_id`, `post_type_id`).
  - probe conservative defaults (`75` for listings, `14` for blog) only when they verify successfully.
- If no candidate verifies:
  - keep IDs unresolved,
  - preserve manual entry path,
  - return precise unresolved reason in test response/UI.

## 3) Confidence Limits
- High confidence for Listings only when search returns listing-like rows and preflight data type is not contradictory.
- Blog detection is accepted only when search returns blog-like rows and does not look like listings payload.
- Detection is intentionally conservative: unresolved is preferred over weak guesses.

## 4) False-Positive Avoidance
- Candidate IDs are never accepted without endpoint verification.
- Listings verification checks listing-shaped records, not just HTTP 200.
- Blog verification checks blog-shaped records and rejects listing-shaped responses.
- Category `data_type` mismatches are treated as disqualifiers where available.

## 5) UI Behavior When Detection Is Uncertain
- Test/auto-detect flow reports explicit unresolved reasons:
  - missing listings ID with no confident detection,
  - listings ID unverified,
  - blog ID missing/unverified.
- Manual fields remain editable and continue to work as override.
- UI keeps clear next step: use “Auto-detect IDs” again after path/key fixes or enter IDs manually.
