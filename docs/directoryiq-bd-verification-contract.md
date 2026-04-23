# DirectoryIQ BD Verification Contract

## Canonical Validity
- Canonical source of truth for BD post type validity is `data_categories`.
- A post type ID is considered valid when `GET /api/v2/data_categories/get/{data_id}` returns a successful payload that contains that category.
- Active post type enumeration may use:
  - `GET /api/v2/data_categories/get?property=data_active&property_value=1`
  - fallback search/list endpoints if needed.

## Operational Validation
- Listings/blog search endpoints are secondary operational checks.
- They validate path/endpoint behavior and row usability, not canonical ID existence.
- Search failures should not erase canonical ID validity; they should be reported as operational issues.

## Status Semantics
- `verified`: canonical post type is valid and operational search returned expected rows.
- `verified_empty`: canonical post type is valid, but search returned zero rows or could not confirm content shape.
- `invalid`: canonical lookup says the post type is missing or contextually wrong (for example blog ID resolves to listings type).
- `unresolved`: canonical validity could not be determined due to indeterminate upstream payload/response conditions.

## UI/UX Expectations
- Valid IDs should not appear as unresolved solely because row count is zero.
- UI should distinguish valid-but-empty and operational path issues from truly invalid IDs.
