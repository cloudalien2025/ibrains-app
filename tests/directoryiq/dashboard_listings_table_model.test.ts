import { describe, expect, it } from "vitest";
import {
  resolveDashboardListingCategory,
  sortDashboardListings,
  toggleDashboardListingsSort,
  type DashboardListingRow,
} from "@/app/(brains)/directoryiq/dashboard-listings-table-model";

function row(input: Partial<DashboardListingRow> & Pick<DashboardListingRow, "listing_id" | "listing_name" | "score">): DashboardListingRow {
  return {
    listing_id: input.listing_id,
    listing_name: input.listing_name,
    score: input.score,
    category: input.category ?? null,
    authority_status: input.authority_status ?? "needs_support",
    authority_score: input.authority_score ?? null,
    trust_status: input.trust_status ?? "needs_trust",
    trust_score: input.trust_score ?? null,
    last_optimized: input.last_optimized ?? null,
  };
}

describe("directoryiq dashboard listings table model", () => {
  const rows: DashboardListingRow[] = [
    row({
      listing_id: "a",
      listing_name: "Zulu Plumbing",
      category: "Home Services",
      score: 72,
      authority_status: "needs_support",
      authority_score: 45,
      trust_status: "needs_trust",
      trust_score: 55,
    }),
    row({
      listing_id: "b",
      listing_name: "Alpha Bakery",
      category: "Food",
      score: 88,
      authority_status: "strong",
      authority_score: 91,
      trust_status: "needs_trust",
      trust_score: 40,
    }),
    row({
      listing_id: "c",
      listing_name: "Beta Dental",
      score: 65,
      authority_status: "needs_support",
      authority_score: 60,
      trust_status: "strong",
      trust_score: 90,
    }),
  ];

  it("resolves canonical category and keeps null when absent", () => {
    expect(resolveDashboardListingCategory(rows[0])).toBe("Home Services");
    expect(resolveDashboardListingCategory(rows[2])).toBeNull();
  });

  it("sorts listing/category/score/authority/trust deterministically", () => {
    const byListingAsc = sortDashboardListings(rows, { key: "listing", direction: "asc" }).map((item) => item.listing_id);
    expect(byListingAsc).toEqual(["b", "c", "a"]);

    const byCategoryAsc = sortDashboardListings(rows, { key: "category", direction: "asc" }).map((item) => item.listing_id);
    expect(byCategoryAsc).toEqual(["b", "a", "c"]);

    const byCategoryDesc = sortDashboardListings(rows, { key: "category", direction: "desc" }).map((item) => item.listing_id);
    expect(byCategoryDesc).toEqual(["a", "b", "c"]);

    const byScoreDesc = sortDashboardListings(rows, { key: "score", direction: "desc" }).map((item) => item.listing_id);
    expect(byScoreDesc).toEqual(["b", "a", "c"]);

    const byAuthorityDesc = sortDashboardListings(rows, { key: "authority", direction: "desc" }).map((item) => item.listing_id);
    expect(byAuthorityDesc).toEqual(["b", "c", "a"]);

    const byTrustAsc = sortDashboardListings(rows, { key: "trust", direction: "asc" }).map((item) => item.listing_id);
    expect(byTrustAsc).toEqual(["b", "a", "c"]);
  });

  it("preserves original order when sorted values tie (stable sort)", () => {
    const tiedRows: DashboardListingRow[] = [
      row({ listing_id: "1", listing_name: "Echo", score: 70, authority_score: 50, trust_score: 50 }),
      row({ listing_id: "2", listing_name: "Echo", score: 70, authority_score: 50, trust_score: 50 }),
      row({ listing_id: "3", listing_name: "Echo", score: 70, authority_score: 50, trust_score: 50 }),
    ];

    const sorted = sortDashboardListings(tiedRows, { key: "listing", direction: "asc" }).map((item) => item.listing_id);
    expect(sorted).toEqual(["1", "2", "3"]);
  });

  it("toggles direction and resets to ascending when switching columns", () => {
    expect(toggleDashboardListingsSort(null, "score")).toEqual({ key: "score", direction: "asc" });
    expect(toggleDashboardListingsSort({ key: "score", direction: "asc" }, "score")).toEqual({ key: "score", direction: "desc" });
    expect(toggleDashboardListingsSort({ key: "score", direction: "desc" }, "listing")).toEqual({
      key: "listing",
      direction: "asc",
    });
  });
});
