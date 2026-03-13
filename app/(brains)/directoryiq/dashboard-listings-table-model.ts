export type DashboardListingRow = {
  listing_id: string;
  listing_name: string;
  category?: string | null;
  group_category?: string | null;
  category_name?: string | null;
  listing_category?: string | null;
  score: number;
  authority_status: string;
  authority_score?: number | null;
  trust_status: string;
  trust_score?: number | null;
  last_optimized: string | null;
};

export type DashboardListingsSortKey = "listing" | "category" | "score" | "authority" | "trust";
export type DashboardListingsSortDirection = "asc" | "desc";

export type DashboardListingsSort = {
  key: DashboardListingsSortKey;
  direction: DashboardListingsSortDirection;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function compareNullableTextNullLast(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: DashboardListingsSortDirection
): number {
  const a = normalizeText(left);
  const b = normalizeText(right);
  const aMissing = !a;
  const bMissing = !b;

  if (aMissing || bMissing) {
    if (aMissing && bMissing) return 0;
    return aMissing ? 1 : -1;
  }

  const delta = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? delta : -delta;
}

function compareNumber(left: number, right: number, direction: DashboardListingsSortDirection): number {
  return direction === "asc" ? left - right : right - left;
}

function normalizedStatus(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, "_");
}

function statusRank(value: string): number {
  if (value === "strong") return 2;
  if (value.startsWith("needs_")) return 1;
  return 0;
}

function resolveAuthoritySortValue(row: DashboardListingRow): number {
  if (typeof row.authority_score === "number" && Number.isFinite(row.authority_score)) return row.authority_score;
  return statusRank(normalizedStatus(row.authority_status));
}

function resolveTrustSortValue(row: DashboardListingRow): number {
  if (typeof row.trust_score === "number" && Number.isFinite(row.trust_score)) return row.trust_score;
  return statusRank(normalizedStatus(row.trust_status));
}

export function resolveDashboardListingCategory(row: DashboardListingRow): string | null {
  const candidates = [row.category, row.group_category, row.category_name, row.listing_category];
  for (const candidate of candidates) {
    const trimmed = (candidate ?? "").trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function toggleDashboardListingsSort(
  current: DashboardListingsSort | null,
  key: DashboardListingsSortKey
): DashboardListingsSort {
  if (current?.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sortDashboardListings(rows: DashboardListingRow[], sort: DashboardListingsSort | null): DashboardListingRow[] {
  if (!sort) return rows.slice();

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      let delta = 0;

      switch (sort.key) {
        case "listing":
          delta = compareNullableTextNullLast(left.row.listing_name, right.row.listing_name, sort.direction);
          break;
        case "category":
          delta = compareNullableTextNullLast(
            resolveDashboardListingCategory(left.row),
            resolveDashboardListingCategory(right.row),
            sort.direction
          );
          break;
        case "score":
          delta = compareNumber(left.row.score, right.row.score, sort.direction);
          break;
        case "authority":
          delta = compareNumber(resolveAuthoritySortValue(left.row), resolveAuthoritySortValue(right.row), sort.direction);
          break;
        case "trust":
          delta = compareNumber(resolveTrustSortValue(left.row), resolveTrustSortValue(right.row), sort.direction);
          break;
      }

      if (delta !== 0) return delta;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}
