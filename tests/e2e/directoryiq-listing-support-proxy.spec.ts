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
    await expect(page.getByRole("heading", { name: "Step 1: Find Support" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("step1-real-existing-connections")).toBeVisible();
    await expect(page.getByTestId("step1-real-mentions-without-links")).toBeVisible();
    await expect(page.getByTestId("step1-derived-recommendations")).toBeVisible();
    await expect(page.getByTestId("step1-validity-summary")).toBeVisible();
    await expect(page.getByTestId("step1-validity-summary")).toContainText("Valid support posts found:");
    await expect(page.getByTestId("step1-validity-summary")).toContainText("Upgrade candidates:");
    await expect(page.getByTestId("step1-validity-summary")).toContainText("Missing support types:");
    const pageText = await page.locator("body").innerText();
    expect(pageText).toMatch(/REAL EXISTING CONNECTIONS\s*\d+/i);
    expect(pageText).toMatch(/REAL MENTIONS WITHOUT LINKS\s*\d+/i);
    expect(pageText).toMatch(/VALID SUPPORT FOUND\s*\d+/i);
    expect(pageText).toMatch(/IN MISSION PLAN\s*\d+/i);
    await expect(page.getByText(/connect ETIMEDOUT/i)).toHaveCount(0);
    await expect(page.getByText("Failed to load support model.")).toHaveCount(0);
  });
});
