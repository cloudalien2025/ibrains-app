import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ Authority Section", () => {
  test("authority routes render nav and empty states without 404", async ({ page }) => {
    await page.route("**/api/directoryiq/authority/overview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          overview: {
            totalNodes: 0,
            totalEdges: 0,
            totalEvidence: 0,
            blogNodes: 0,
            listingNodes: 0,
            lastIngestionRunAt: null,
            lastGraphRunAt: null,
            lastGraphRunStatus: null,
          },
        }),
      });
    });

    await page.route("**/api/directoryiq/authority/blogs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, blogs: [] }),
      });
    });

    await page.route("**/api/directoryiq/authority/listings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, listings: [] }),
      });
    });

    await page.route("**/api/directoryiq/authority/ingest/blogs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          ingest: {
            status: "succeeded",
            counts: { blogPosts: 0 },
            blogPostsDataId: 14,
          },
          graph: { runId: "mock", stats: {} },
        }),
      });
    });

    await page.route("**/api/directoryiq/graph/issues", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          issues: {
            orphans: [],
            mentions_without_links: [],
            weak_anchors: [],
            lastRun: null,
          },
        }),
      });
    });

    await page.route("**/api/directoryiq/graph/rebuild", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, runId: "mock", stats: {} }),
      });
    });

    await page.goto("/directoryiq/authority", { waitUntil: "networkidle" });
    const authorityNav = page.getByTestId("authority-section-nav");

    await expect(page.getByRole("button", { name: "Run Blog Ingestion" })).toBeVisible();
    await expect(authorityNav.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(authorityNav.getByRole("link", { name: "Blog Posts" })).toBeVisible();
    await expect(authorityNav.getByRole("link", { name: "Listings" })).toBeVisible();
    await expect(authorityNav.getByRole("link", { name: "Leak Scanner" })).toBeVisible();

    await page.getByRole("button", { name: "Run Blog Ingestion" }).click();
    await expect(page.getByText(/Blog ingestion completed\./)).toBeVisible();

    await authorityNav.getByRole("link", { name: "Blog Posts" }).click();
    await expect(page).toHaveURL(/\/directoryiq\/authority\/blogs/);
    await expect(page.getByText("No blog nodes found yet. Run Blog Ingestion from Overview.")).toBeVisible();

    await page.getByTestId("authority-section-nav").getByRole("link", { name: "Listings" }).click();
    await expect(page).toHaveURL(/\/directoryiq\/authority\/listings/);
    await expect(page.getByText("No listing authority rows yet. Run Blog Ingestion from Overview.")).toBeVisible();

    await page.getByTestId("authority-section-nav").getByRole("link", { name: "Leak Scanner" }).click();
    await expect(page).toHaveURL(/\/directoryiq\/authority\/authority-support/);
    await expect(page.getByText("No issues in this bucket.")).toBeVisible();

    await expect(page.getByText("This page could not be found.")).toHaveCount(0);
  });
});
