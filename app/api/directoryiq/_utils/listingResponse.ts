function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.some((row) => row && typeof row === "object");
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
}

function firstArray(candidates: unknown[]): Record<string, unknown>[] {
  for (const candidate of candidates) {
    if (isRecordArray(candidate)) return toRecordArray(candidate);
  }
  return [];
}

export function extractBdListingRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return toRecordArray(payload);
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  const direct = firstArray([record.message, record.data, record.records, record.results, record.rows, record.items]);
  if (direct.length > 0) return direct;

  const nestedKeys = ["items", "rows", "records", "results", "posts", "data_posts", "listings"] as const;
  for (const container of [record.message, record.data]) {
    if (!container || typeof container !== "object" || Array.isArray(container)) continue;
    const typed = container as Record<string, unknown>;
    for (const key of nestedKeys) {
      const rows = firstArray([typed[key]]);
      if (rows.length > 0) return rows;
    }
    for (const value of Object.values(typed)) {
      const rows = firstArray([value]);
      if (rows.length > 0) return rows;
    }
  }

  return [];
}

export function isBdListingLikeRow(row: Record<string, unknown>): boolean {
  const hasCanonicalId = Boolean(asString(row.group_id) || asString(row.listing_id) || asString(row.listingId));
  const hasName = Boolean(asString(row.group_name) || asString(row.title) || asString(row.name));
  const hasLocator = Boolean(
    asString(row.group_filename) ||
      asString(row.url) ||
      asString(row.listing_url) ||
      asString(row.profile_url) ||
      asString(row.link) ||
      asString(row.permalink)
  );
  return hasCanonicalId && (hasName || hasLocator);
}

export function hasBdListingLikeRows(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => isBdListingLikeRow(row));
}

