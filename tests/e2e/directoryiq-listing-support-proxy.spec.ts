import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ listing support proxy path", () => {
  test("loads current support without DB timeout error text", async ({ page }) => {
    const listingId = "99";
    const step1Section = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "Step 1: Audit this listing" }) })
      .first();

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    const supportResponse = await page.waitForResponse(
      (response) =>
        response.url().includes(`/api/directoryiq/listings/${listingId}/support`) &&
        response.request().method() === "GET",
      { timeout: 15_000 }
    );
    expect(supportResponse.status()).toBe(200);

    await page.getByTestId("listing-step-nav-desktop-audit").click();
    await expect(page.getByRole("heading", { name: "Step 1: Audit this listing" })).toBeVisible({ timeout: 15_000 });
    await expect(step1Section.getByText("Supporting links in", { exact: true })).toBeVisible();
    await expect(step1Section.getByText("Mentions without links", { exact: true })).toBeVisible();
    await expect(step1Section.getByText("Connected support pages", { exact: true })).toBeVisible();
    const pageText = await page.locator("body").innerText();
    expect(pageText).toMatch(/SUPPORTING LINKS IN\s*(\d+|—)/i);
    expect(pageText).toMatch(/MENTIONS WITHOUT LINKS\s*(\d+|—)/i);
    expect(pageText).toMatch(/CONNECTED SUPPORT PAGES\s*(\d+|—)/i);
    await expect(page.getByText(/connect ETIMEDOUT/i)).toHaveCount(0);
    await expect(page.getByText("Failed to load support model.")).toHaveCount(0);
  });
});
