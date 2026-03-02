import { expect, test } from "@playwright/test";

const leak = {
  blogNodeId: "blog-1",
  blogTitle: "Best Local Services in Aspen",
  blogUrl: "https://example.com/blog/best-local-services-in-aspen",
  listingNodeId: "listing-1",
  listingTitle: "Aspen Service Hub",
  listingUrl: "https://example.com/listings/aspen-service-hub",
  evidenceSnippet: "Aspen Service Hub is known across the valley for fast response.",
  strengthScore: 0.88,
};

test("approve push requires explicit action and updates status", async ({ page }) => {
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
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leaks: [leak] }) });
  });

  await page.route("**/api/directoryiq/authority-network/fixes/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        diffJson: { insertions: 1, changed: true },
        renderedPreviewHtml: "<p><a href=\"https://example.com/listings/aspen-service-hub\">Aspen Service Hub</a></p>",
        beforeHtml: "<p>Aspen Service Hub is known across the valley.</p>",
        afterHtml: "<p><a href=\"https://example.com/listings/aspen-service-hub\">Aspen Service Hub</a> is known across the valley.</p>",
        linkChecks: { blogToListing: "ok", listingToBlog: "missing" },
      }),
    });
  });

  await page.route("**/api/directoryiq/authority-network/fixes/approve", async (route) => {
    const payload = route.request().postDataJSON() as { approved?: boolean };
    if (payload.approved !== true) {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "approved=true is required" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: "pending_manual_apply" }),
    });
  });

  await page.goto("/directoryiq/authority-network", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Preview Fix" }).click();
  await page.getByRole("button", { name: "Approve & Apply" }).click();
  await expect(page.getByText(/Fix applied with status: pending_manual_apply/i)).toBeVisible();
});
