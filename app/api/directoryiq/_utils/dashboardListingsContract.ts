type DashboardListingLike = Record<string, unknown>;

type CanonicalListingRow = {
  sourceId: string;
  listingId: string;
  category: string | null;
  siteId?: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveCategory(row: DashboardListingLike): string | null {
  const candidates = [
    asString(row.category),
    asString(row.group_category),
    asString(row.category_name),
    asString(row.listing_category),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
}

function resolveListingId(row: DashboardListingLike): string {
  return asString(row.listing_id);
}

function resolveSiteId(row: DashboardListingLike): string {
  return asString(row.bd_site_id) || asString(row.site_id);
}

export function normalizeDashboardListingsContract(
  listings: DashboardListingLike[],
  canonicalRows: CanonicalListingRow[]
): DashboardListingLike[] {
  const byListingId = new Map<string, CanonicalListingRow[]>();
  for (const row of canonicalRows) {
    const listingId = asString(row.listingId);
    if (!listingId) continue;
    const group = byListingId.get(listingId) ?? [];
    group.push(row);
    byListingId.set(listingId, group);
  }

  const seenPerListingId = new Map<string, number>();

  return listings.map((rawRow, index) => {
    const row = { ...rawRow };
    const listingId = resolveListingId(row);
    const siteId = resolveSiteId(row);
    const occurrence = (seenPerListingId.get(listingId) ?? 0) + 1;
    seenPerListingId.set(listingId, occurrence);

    const candidates = byListingId.get(listingId) ?? [];
    let matched: CanonicalListingRow | undefined = candidates[occurrence - 1];
    if (!matched && siteId) {
      matched = candidates.find((candidate) => asString(candidate.siteId) === siteId);
    }
    if (!matched && candidates.length > 0) {
      matched = candidates[Math.min(candidates.length - 1, occurrence - 1)];
    }

    const canonicalCategory = (matched?.category ?? "").trim();
    const category = resolveCategory(row) ?? (canonicalCategory || null);
    if (category) {
      row.category = category;
    }

    const listingSourceId = asString(row.listing_source_id) || matched?.sourceId || "";
    if (listingSourceId) {
      row.listing_source_id = listingSourceId;
    }

    const existingRowId = asString(row.listing_row_id);
    if (!existingRowId) {
      row.listing_row_id = listingSourceId || `${listingId || asString(row.listing_name) || "listing"}:${occurrence}:${index + 1}`;
    }

    return row;
  });
}
