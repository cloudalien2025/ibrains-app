import { expect, test } from "@playwright/test";

const leakPayload = {
  leaks: [
    {
      blogNodeId: "blog-1",
      blogTitle: "Best Local Services in Aspen",
      blogUrl: "https://example.com/blog/best-local-services-in-aspen",
      listingNodeId: "listing-1",
      listingTitle: "Aspen Service Hub",
      listingUrl: "https://example.com/listings/aspen-service-hub",
      evidenceSnippet: "Aspen Service Hub is known across the valley for fast response.",
      strengthScore: 0.88,
    },
  ],
};

test("leak scanner surfaces missing-link rows", async ({ page }) => {
  await page.route("**/api/directoryiq/authority-network/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        networkHealthScore: 61,
        leaks: 1,
        weakAnchors: 0,
        orphanListings: 1,
        hubCoveragePercent: 30,
        coveredListings: 3,
        totalListings: 10,
      }),
    });
  });

  await page.route("**/api/directoryiq/authority-network/leaks", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(leakPayload) });
  });

  await page.goto("/directoryiq/authority-network", { waitUntil: "networkidle" });
  await expect(page.getByText("Best Local Services in Aspen")).toBeVisible();
  await expect(page.getByText(/Missing link to: Aspen Service Hub/i)).toBeVisible();
});
