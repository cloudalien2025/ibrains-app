import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ listing hero visuals", () => {
  test("renders hero image or fallback with glass panel on listing pages", async ({ page }) => {
    const consoleErrors: Array<{ type: string; text: string; url?: string }> = [];
    const pageErrors: Array<string> = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          type: msg.type(),
          text: msg.text(),
          url: msg.location().url || undefined,
        });
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    function isIgnorableConsoleError(entry: { text: string; url?: string }) {
      if (!entry.text.includes("Failed to load resource")) return false;
      if (
        !entry.text.includes("400 (Bad Request)") &&
        !entry.text.includes("401 (Unauthorized)") &&
        !entry.text.includes("404 (Not Found)")
      ) {
        return false;
      }
      const target = entry.url ?? entry.text;
      return (
        target.includes("/api/directoryiq/listings/") ||
        target.includes("/api/directoryiq/integrations") ||
        target.includes("/api/directoryiq/signal-sources")
      );
    }

    const listingId = "99";
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    await page
      .waitForResponse(
        (response) =>
          response.url().includes(`/api/directoryiq/listings/${listingId}`) &&
          response.request().method() === "GET",
        { timeout: 8_000 }
      )
      .catch(() => null);

    const shell = page.locator(".ecomviper-hud");
    await expect(shell).toBeVisible({ timeout: 15_000 });
    const grid = page.locator(".ecomviper-grid");
    await expect(grid).toBeVisible();

    const heroContainer = page.getByTestId("listing-mission-header");
    await heroContainer.waitFor({ state: "visible", timeout: 15_000 });
    await expect(heroContainer).toBeVisible();

    const hero = page.getByTestId("listing-mission-header");
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    const heroTitle = hero.getByRole("heading", { level: 1 });
    const titleText = (await heroTitle.textContent())?.trim() ?? "";
    expect(titleText).not.toMatch(/undefined/i);
    expect(titleText.length).toBeGreaterThan(0);
    await expect(page.getByTestId("listing-hero-node")).toBeVisible();

    const fatalConsoleErrors = consoleErrors.filter((entry) => !isIgnorableConsoleError(entry));
    expect(fatalConsoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
