import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ authority read error contract", () => {
  test("authority pages show explicit errors for 200 + ok:false payloads", async ({ page }) => {
    await page.route("**/api/directoryiq/authority/overview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
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
          error: { message: "overview masked failure" },
        }),
      });
    });
    await page.route("**/api/directoryiq/authority/blogs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          blogs: [],
          error: { message: "blogs masked failure" },
        }),
      });
    });
    await page.route("**/api/directoryiq/authority/listings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          listings: [],
          error: { message: "listings masked failure" },
        }),
      });
    });

    await page.goto("/directoryiq/authority", { waitUntil: "networkidle" });
    await expect(page.getByText("overview masked failure")).toBeVisible();

    await page.goto("/directoryiq/authority/blogs", { waitUntil: "networkidle" });
    await expect(page.getByText("blogs masked failure")).toBeVisible();

    await page.goto("/directoryiq/authority/listings", { waitUntil: "networkidle" });
    await expect(page.getByText("listings masked failure")).toBeVisible();
  });
});
