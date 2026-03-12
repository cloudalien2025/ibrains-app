import { expect, test } from "@playwright/test";

const ENTRYPOINTS = ["/directoryiq/authority-support", "/directoryiq/authority/authority-support"] as const;

test.describe("DirectoryIQ authority-support entrypoint parity", () => {
  test("both entrypoints render the same initial leak counts and successful scan behavior", async ({ page }) => {
    test.skip(process.env.E2E_MOCK_GRAPH !== "1", "E2E_MOCK_GRAPH=1 required.");

    for (const path of ENTRYPOINTS) {
      await page.goto(path, { waitUntil: "networkidle" });

      const scanButton = page.getByRole("button", { name: "Scan for Authority Leaks" });
      await expect(scanButton).toBeVisible();

      const orphanCard = page.getByRole("button", { name: /Orphan Listings/i });
      const mentionCard = page.getByRole("button", { name: /Mentions Without Links/i });
      const weakCard = page.getByRole("button", { name: /Weak Anchors/i });

      await expect(orphanCard.locator(".text-2xl")).toHaveText("1");
      await expect(mentionCard.locator(".text-2xl")).toHaveText("1");
      await expect(weakCard.locator(".text-2xl")).toHaveText("1");

      await scanButton.click();
      await expect(page.getByText(/Scan completed\./)).toBeVisible();
      await expect(orphanCard.locator(".text-2xl")).toHaveText("1");
      await expect(mentionCard.locator(".text-2xl")).toHaveText("1");
      await expect(weakCard.locator(".text-2xl")).toHaveText("1");
    }
  });

  test("both entrypoints show the same error state when graph/issues refresh fails", async ({ page }) => {
    await page.route("**/api/directoryiq/graph/rebuild", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          runId: "mock-run-001",
          stats: { nodesCreated: 2, edgesUpserted: 2, evidenceCount: 2 },
        }),
      });
    });
    await page.route("**/api/directoryiq/graph/issues", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Failed to load authority graph issues." },
        }),
      });
    });

    for (const path of ENTRYPOINTS) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Scan for Authority Leaks" }).click();
      await expect(page.getByText("Failed to load authority graph issues.")).toBeVisible();
    }
  });
});
