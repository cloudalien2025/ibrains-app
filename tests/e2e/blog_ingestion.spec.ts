import { expect, test } from "@playwright/test";

test("blog ingestion trigger starts deterministic job", async ({ page }) => {
  await page.route("**/api/directoryiq/authority-network/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        networkHealthScore: 92,
        leaks: 0,
        weakAnchors: 0,
        orphanListings: 0,
        hubCoveragePercent: 80,
        coveredListings: 8,
        totalListings: 10,
      }),
    });
  });

  await page.route("**/api/directoryiq/authority-network/leaks", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leaks: [] }) });
  });

  await page.route("**/api/directoryiq/authority-network/ingest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, jobId: "job-123", status: "queued", dryRun: false }),
    });
  });

  await page.goto("/directoryiq/authority-network", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ingest Blogs" }).click();
  await expect(page.getByText(/Ingestion job queued: job-123/i)).toBeVisible();
});
