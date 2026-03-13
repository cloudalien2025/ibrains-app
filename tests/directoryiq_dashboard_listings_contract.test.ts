import { describe, expect, it } from "vitest";
import { normalizeDashboardListingsContract } from "@/app/api/directoryiq/_utils/dashboardListingsContract";

describe("directoryiq dashboard listings payload contract", () => {
  it("hydrates missing category and stable unique row identity from canonical rows", () => {
    const listings = [
      {
        listing_id: "142",
        listing_name: "Cedar at Streamside",
        score: 55,
      },
      {
        listing_id: "142",
        listing_name: "Cedar at Streamside",
        score: 55,
      },
      {
        listing_id: "128",
        listing_name: "Buzz's Ski Shop",
        score: 55,
      },
    ];

    const canonical = [
      {
        sourceId: "site-a:142",
        listingId: "142",
        category: "Hotels",
        siteId: "site-a",
      },
      {
        sourceId: "site-b:142",
        listingId: "142",
        category: "Hotels",
        siteId: "site-b",
      },
      {
        sourceId: "site-a:128",
        listingId: "128",
        category: "Ski Rentals",
        siteId: "site-a",
      },
    ];

    const normalized = normalizeDashboardListingsContract(listings, canonical);

    expect(normalized.map((row) => row.category)).toEqual(["Hotels", "Hotels", "Ski Rentals"]);
    expect(new Set(normalized.map((row) => row.listing_row_id)).size).toBe(3);
    expect(normalized.map((row) => row.listing_row_id)).toEqual(["site-a:142", "site-b:142", "site-a:128"]);
  });
});

