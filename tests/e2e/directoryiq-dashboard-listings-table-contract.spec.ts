import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ dashboard listings table contract", () => {
  test("renders category and deterministic sortable columns", async ({ page }) => {
    await page.route("**/api/directoryiq/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connected: true,
          readiness: 68,
          pillars: { structure: 66, clarity: 67, trust: 65, authority: 70, actionability: 72 },
          listings: [
            {
              listing_id: "1",
              listing_name: "Zulu Plumbing",
              category: "Home Services",
              score: 72,
              authority_status: "needs_support",
              authority_score: 45,
              trust_status: "needs_trust",
              trust_score: 55,
              last_optimized: null,
            },
            {
              listing_id: "2",
              listing_name: "Alpha Bakery",
              category: "Food",
              score: 88,
              authority_status: "strong",
              authority_score: 91,
              trust_status: "needs_trust",
              trust_score: 40,
              last_optimized: null,
            },
            {
              listing_id: "3",
              listing_name: "Beta Dental",
              category: null,
              score: 65,
              authority_status: "needs_support",
              authority_score: 60,
              trust_status: "strong",
              trust_score: 90,
              last_optimized: null,
            },
          ],
          vertical_detected: "general",
          vertical_override: null,
          last_analyzed_at: null,
          progress_messages: ["Evaluating selection signals..."],
        }),
      });
    });

    await page.goto("/directoryiq", { waitUntil: "networkidle" });

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: /Category/i })).toBeVisible();

    const listingCells = table.locator("tbody tr td:first-child");
    await expect(listingCells.nth(0)).toHaveText("Zulu Plumbing");

    await table.getByRole("button", { name: /^Listing/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Alpha Bakery");

    await table.getByRole("button", { name: /^Listing/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Zulu Plumbing");

    await table.getByRole("button", { name: /^Category/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Alpha Bakery");

    await table.getByRole("button", { name: /^Category/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Zulu Plumbing");

    await table.getByRole("button", { name: /^Score/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Beta Dental");

    await table.getByRole("button", { name: /^Score/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Alpha Bakery");

    await table.getByRole("button", { name: /^Authority/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Zulu Plumbing");

    await table.getByRole("button", { name: /^Authority/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Alpha Bakery");

    await table.getByRole("button", { name: /^Trust/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Alpha Bakery");

    await table.getByRole("button", { name: /^Trust/ }).click();
    await expect(listingCells.nth(0)).toHaveText("Beta Dental");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "AI Visibility Dashboard" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Category/i })).toBeVisible();
  });

  test("uses unique dashboard row identity so sorting visibly reorders even with duplicate listing_id", async ({ page }) => {
    await page.route("**/api/directoryiq/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connected: true,
          readiness: 68,
          pillars: { structure: 66, clarity: 67, trust: 65, authority: 70, actionability: 72 },
          listings: [
            {
              listing_row_id: "site-a:142",
              listing_id: "142",
              listing_name: "Cedar at Streamside",
              category: "Hotels",
              score: 55,
              authority_status: "needs_support",
              authority_score: 45,
              trust_status: "needs_trust",
              trust_score: 55,
              last_optimized: null,
            },
            {
              listing_row_id: "site-b:142",
              listing_id: "142",
              listing_name: "Cedar at Streamside",
              category: "Hotels",
              score: 57,
              authority_status: "strong",
              authority_score: 91,
              trust_status: "strong",
              trust_score: 90,
              last_optimized: null,
            },
            {
              listing_row_id: "site-a:128",
              listing_id: "128",
              listing_name: "Buzz's Ski Shop",
              category: "Ski Rentals",
              score: 56,
              authority_status: "needs_support",
              authority_score: 60,
              trust_status: "needs_trust",
              trust_score: 40,
              last_optimized: null,
            },
          ],
          vertical_detected: "general",
          vertical_override: null,
          last_analyzed_at: null,
          progress_messages: ["Evaluating selection signals..."],
        }),
      });
    });

    await page.goto("/directoryiq", { waitUntil: "networkidle" });

    const table = page.getByRole("table");
    const listingCells = table.locator("tbody tr td:first-child");
    const scoreCells = table.locator("tbody tr td:nth-child(3)");

    await expect(scoreCells.nth(0)).toHaveText("55");
    await table.getByRole("button", { name: /^Score/ }).click();
    await expect(scoreCells.nth(0)).toHaveText("55");
    await table.getByRole("button", { name: /^Score/ }).click();
    await expect(scoreCells.nth(0)).toHaveText("57");
    await expect(listingCells.nth(0)).toHaveText("Cedar at Streamside");
  });
});
