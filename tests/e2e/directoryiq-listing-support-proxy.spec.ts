import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ listing support proxy path", () => {
  test("loads current support without DB timeout error text", async ({ page }) => {
    const listingId = "99";
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    const supportResponse = await page.waitForResponse(
      (response) =>
        response.url().includes(`/api/directoryiq/listings/${listingId}/support`) &&
        response.request().method() === "GET",
      { timeout: 15_000 }
    );
    expect(supportResponse.status()).toBe(200);

    await page.getByTestId("listing-step-nav-desktop-make-connections").click();
    await expect(page.getByRole("heading", { name: "Step 1: Make Connections" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Existing support", { exact: true })).toBeVisible();
    await expect(page.getByText("Connect now", { exact: true })).toBeVisible();
    await expect(page.getByText("Missing assets", { exact: true })).toBeVisible();
    const pageText = await page.locator("body").innerText();
    expect(pageText).toMatch(/EXISTING SUPPORT\s*\d+/i);
    expect(pageText).toMatch(/CONNECT NOW\s*\d+/i);
    expect(pageText).toMatch(/MISSING ASSETS\s*\d+/i);
    await expect(page.getByText(/connect ETIMEDOUT/i)).toHaveCount(0);
    await expect(page.getByText("Failed to load support model.")).toHaveCount(0);
  });
});
