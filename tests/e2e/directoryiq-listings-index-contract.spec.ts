import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ listings index interactions", () => {
  test("search, category column, and sorting are deterministic", async ({ page }) => {
    await page.route("**/api/directoryiq/sites**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sites: [], is_admin: false }),
      });
    });

    await page.route("**/api/directoryiq/listings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listings: [
            {
              listing_id: "1",
              listing_name: "Zephyr Hotel",
              url: "https://example.com/zephyr",
              score: 72,
              pillars: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
              authority_status: "stable",
              trust_status: "stable",
              last_optimized: "2026-03-11T00:00:00.000Z",
              site_id: "site-1",
              site_label: "Site B",
              category: "hotel",
            },
            {
              listing_id: "2",
              listing_name: "Alpine Bistro",
              url: "https://example.com/alpine",
              score: 88,
              pillars: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
              authority_status: "stable",
              trust_status: "stable",
              last_optimized: "2026-03-12T00:00:00.000Z",
              site_id: "site-1",
              site_label: "Site A",
              group_category: "restaurant",
            },
            {
              listing_id: "3",
              listing_name: "City Market",
              url: "https://example.com/city-market",
              score: 64,
              pillars: { structure: 0, clarity: 0, trust: 0, authority: 0, actionability: 0 },
              authority_status: "stable",
              trust_status: "stable",
              last_optimized: null,
              site_id: "site-1",
              site_label: "Site C",
              raw_json: { category_name: "shop" },
            },
          ],
        }),
      });
    });

    await page.goto("/directoryiq/listings", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("columnheader", { name: /Category/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hotel", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Restaurant", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Shop", exact: true })).toBeVisible();

    const search = page.getByPlaceholder("Search listings...");
    await search.fill(" restaurant ");
    await expect(page.getByText("Alpine Bistro")).toBeVisible();
    await expect(page.getByText("Zephyr Hotel")).toHaveCount(0);

    await search.fill("");
    await expect(page.getByText("Zephyr Hotel")).toBeVisible();

    await page.getByRole("button", { name: /Score/i }).click();
    let firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText("City Market");

    await page.getByRole("button", { name: /Score/i }).click();
    firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText("Alpine Bistro");

    await page.getByRole("button", { name: /Category/i }).click();
    firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText("Zephyr Hotel");
  });
});
