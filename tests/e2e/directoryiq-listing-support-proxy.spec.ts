import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ listing support proxy path", () => {
  test("loads current support without DB timeout error text", async ({ page }) => {
    const listingId = "99";

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.waitForResponse(
      (response) =>
        response.url().includes(`/api/directoryiq/listings/${listingId}/support`) &&
        response.request().method() === "GET",
      { timeout: 15_000 }
    );

    await expect(page.getByRole("heading", { name: "What's Helping" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/connect ETIMEDOUT/i)).toHaveCount(0);
    await expect(page.getByText("Failed to load support model.")).toHaveCount(0);

    const noDataSignals = [
      page.getByText("No inbound linked support detected yet."),
      page.getByText("No unlinked mentions detected yet."),
      page.getByText("No outbound support links detected yet."),
      page.getByText("No connected support pages detected yet."),
    ];
    const unresolvedSignal = page.getByText("Support diagnostics are not available yet.");
    if ((await unresolvedSignal.count()) > 0) {
      await expect(unresolvedSignal).toBeVisible();
      return;
    }
    for (const signal of noDataSignals) {
      await expect(signal).toBeVisible();
    }
  });
});
