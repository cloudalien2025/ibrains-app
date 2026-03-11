import { describe, expect, it } from "vitest";
import {
  applyListingsTableModel,
  filterListings,
  formatCategoryLabel,
  resolveListingCategory,
  sortListings,
  type ListingRow,
} from "@/app/(brains)/directoryiq/listings/listings-table-model";

function makeRow(input: Partial<ListingRow> & Pick<ListingRow, "listing_id" | "listing_name" | "score">): ListingRow {
  return {
    listing_id: input.listing_id,
    listing_name: input.listing_name,
    url: input.url ?? null,
    score: input.score,
    pillars: input.pillars ?? {
      structure: 0,
      clarity: 0,
      trust: 0,
      authority: 0,
      actionability: 0,
    },
    authority_status: input.authority_status ?? "unknown",
    trust_status: input.trust_status ?? "unknown",
    last_optimized: input.last_optimized ?? null,
    site_id: input.site_id ?? null,
    site_label: input.site_label ?? null,
    category: input.category ?? null,
    group_category: input.group_category ?? null,
    category_name: input.category_name ?? null,
    primary_category: input.primary_category ?? null,
    listing_category: input.listing_category ?? null,
    industry: input.industry ?? null,
    industry_name: input.industry_name ?? null,
    raw_json: input.raw_json ?? null,
  };
}

describe("listings table model", () => {
  const rows: ListingRow[] = [
    makeRow({ listing_id: "1", listing_name: "Zephyr Hotel", score: 72, category: "hotel", site_label: "Site B" }),
    makeRow({ listing_id: "2", listing_name: "Alpine Bistro", score: 88, group_category: "restaurant", site_label: "Site A" }),
    makeRow({ listing_id: "3", listing_name: "City Market", score: 64, raw_json: { category_name: "shop" }, site_label: null }),
  ];

  it("resolves and formats category from canonical fields", () => {
    expect(resolveListingCategory(rows[0])).toBe("hotel");
    expect(resolveListingCategory(rows[1])).toBe("restaurant");
    expect(resolveListingCategory(rows[2])).toBe("shop");
    expect(formatCategoryLabel("home_services")).toBe("Home Services");
    expect(formatCategoryLabel(null)).toBe("-");
  });

  it("filters by listing name case-insensitively", () => {
    const filtered = filterListings(rows, "  alpine ");
    expect(filtered.map((row) => row.listing_id)).toEqual(["2"]);
  });

  it("filters by category case-insensitively", () => {
    const filtered = filterListings(rows, "RESTAURANT");
    expect(filtered.map((row) => row.listing_id)).toEqual(["2"]);
  });

  it("sorts score numerically", () => {
    const sorted = sortListings(rows, { key: "score", direction: "desc" });
    expect(sorted.map((row) => row.listing_id)).toEqual(["2", "1", "3"]);
  });

  it("sorts category alphabetically with nulls last", () => {
    const withUnknown = [...rows, makeRow({ listing_id: "4", listing_name: "No Category", score: 55 })];
    const sorted = sortListings(withUnknown, { key: "category", direction: "asc" });
    expect(sorted.map((row) => row.listing_id)).toEqual(["1", "2", "3", "4"]);
  });

  it("applies search + sort together deterministically", () => {
    const modeled = applyListingsTableModel(rows, "  ", { key: "listing", direction: "asc" });
    expect(modeled.map((row) => row.listing_name)).toEqual(["Alpine Bistro", "City Market", "Zephyr Hotel"]);
  });
});
