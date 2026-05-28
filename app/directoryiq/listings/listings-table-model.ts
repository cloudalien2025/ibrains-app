export type ListingRow = {
  listing_id: string;
  listing_name: string;
  url: string | null;
  score: number;
  pillars: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
  authority_status: string;
  trust_status: string;
  last_optimized: string | null;
  site_id?: string | null;
  site_label?: string | null;
  category?: string | null;
  group_category?: string | null;
  category_name?: string | null;
  primary_category?: string | null;
  listing_category?: string | null;
  industry?: string | null;
  industry_name?: string | null;
  raw_json?: Record<string, unknown> | null;
};

export type ListingsSortKey = "listing" | "category" | "score" | "site" | "last_optimized";

export type ListingsSortDirection = "asc" | "desc";

export type ListingsSort = {
  key: ListingsSortKey;
  direction: ListingsSortDirection;
};

const textComparator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function firstNonEmpty(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function resolveListingCategory(row: ListingRow): string | null {
  const raw = row.raw_json && typeof row.raw_json === "object" ? row.raw_json : null;
  return firstNonEmpty([
    row.category,
    row.group_category,
    row.category_name,
    row.primary_category,
    row.listing_category,
    row.industry,
    row.industry_name,
    raw?.group_category,
    raw?.category,
    raw?.category_name,
    raw?.primary_category,
    raw?.listing_category,
    raw?.industry,
    raw?.industry_name,
  ]);
}

export function formatCategoryLabel(value: string | null): string {
  if (!value) return "-";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizedText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function filterListings(rows: ListingRow[], searchTerm: string): ListingRow[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const listingName = normalizedText(row.listing_name);
    const category = normalizedText(resolveListingCategory(row));
    return listingName.includes(q) || category.includes(q);
  });
}

function compareText(left: string | null | undefined, right: string | null | undefined, direction: ListingsSortDirection): number {
  const leftValue = (left ?? "").trim();
  const rightValue = (right ?? "").trim();
  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return direction === "asc" ? 1 : -1;
  if (!rightValue) return direction === "asc" ? -1 : 1;
  const delta = textComparator.compare(leftValue, rightValue);
  return direction === "asc" ? delta : -delta;
}

function compareNumber(left: number, right: number, direction: ListingsSortDirection): number {
  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareDate(left: string | null, right: string | null, direction: ListingsSortDirection): number {
  const leftMillis = left ? Date.parse(left) : Number.NaN;
  const rightMillis = right ? Date.parse(right) : Number.NaN;
  const leftMissing = Number.isNaN(leftMillis);
  const rightMissing = Number.isNaN(rightMillis);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return direction === "asc" ? 1 : -1;
  if (rightMissing) return direction === "asc" ? -1 : 1;
  return compareNumber(leftMillis, rightMillis, direction);
}

export function sortListings(rows: ListingRow[], sort: ListingsSort): ListingRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      let delta = 0;
      switch (sort.key) {
        case "listing":
          delta = compareText(left.row.listing_name, right.row.listing_name, sort.direction);
          break;
        case "category":
          delta = compareText(resolveListingCategory(left.row), resolveListingCategory(right.row), sort.direction);
          break;
        case "score":
          delta = compareNumber(left.row.score, right.row.score, sort.direction);
          break;
        case "site":
          delta = compareText(left.row.site_label, right.row.site_label, sort.direction);
          break;
        case "last_optimized":
          delta = compareDate(left.row.last_optimized, right.row.last_optimized, sort.direction);
          break;
      }

      if (delta !== 0) return delta;
      return left.index - right.index;
    })
    .map((entry) => entry.row);
}

export function applyListingsTableModel(rows: ListingRow[], searchTerm: string, sort: ListingsSort): ListingRow[] {
  return sortListings(filterListings(rows, searchTerm), sort);
}
