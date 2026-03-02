import { expect, test } from "@playwright/test";

test("scan network runs entity resolution and scanner", async ({ page }) => {
  await page.route("**/api/directoryiq/authority-network/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        networkHealthScore: 64,
        leaks: 3,
        weakAnchors: 1,
        orphanListings: 2,
        hubCoveragePercent: 40,
        coveredListings: 4,
        totalListings: 10,
      }),
    });
  });

  await page.route("**/api/directoryiq/authority-network/leaks", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leaks: [] }) });
  });

  await page.route("**/api/directoryiq/authority-network/scan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, leakCount: 3, weakAnchorCount: 1, orphanListingCount: 2 }),
    });
  });

  await page.goto("/directoryiq/authority-network", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Scan Network" }).click();
  await expect(page.getByText(/Scan complete. Leaks detected: 3/i)).toBeVisible();
});
