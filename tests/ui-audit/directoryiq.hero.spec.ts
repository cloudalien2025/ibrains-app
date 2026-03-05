import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const artifactRoot = path.join(process.cwd(), "artifacts", "ui-audit", runStamp);
const screenshotsDir = path.join(artifactRoot, "screenshots");
const logsDir = path.join(artifactRoot, "logs");

test.describe("DirectoryIQ listing hero visuals", () => {
  test("renders hero image or fallback with glass panel on listing pages", async ({ page, baseURL }) => {
    await fs.mkdir(screenshotsDir, { recursive: true });
    await fs.mkdir(logsDir, { recursive: true });

    const consoleErrors: Array<{ type: string; text: string; url?: string }> = [];
    const imageFailures: Array<{ url: string; status: number }> = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          type: msg.type(),
          text: msg.text(),
          url: msg.location().url || undefined,
        });
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 400 && response.request().resourceType() === "image") {
        imageFailures.push({ url: response.url(), status: response.status() });
      }
    });

    function isIgnorableConsoleError(entry: { text: string; url?: string }) {
      if (!entry.text.includes("Failed to load resource")) return false;
      if (!entry.text.includes("401 (Unauthorized)")) return false;
      const target = entry.url ?? entry.text;
      return target.includes("/api/directoryiq/listings/") || target.includes("/api/directoryiq/integrations");
    }

    for (const listingId of ["8", "651"]) {
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

      const heroContainer = page.locator('[data-testid="directoryiq-listing-hero"], [data-testid="listing-hero"], .listing-hero, .hero-glass');
      await heroContainer.waitFor({ state: "visible", timeout: 15_000 });
      await expect(heroContainer).toBeVisible();

      const hero = page.getByTestId("directoryiq-listing-hero");
      await expect(hero.locator("h1")).toBeVisible({ timeout: 15_000 });
      const glassPanels = page.getByTestId("directoryiq-hero-glass-panel");
      const visibleGlassPanels = await glassPanels.evaluateAll((elements) =>
        elements.filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
        }).length
      );
      expect(visibleGlassPanels).toBeGreaterThan(0);
    }

    await fs.writeFile(path.join(logsDir, "directoryiq-hero-console-errors.json"), JSON.stringify(consoleErrors, null, 2), "utf8");
    await fs.writeFile(path.join(logsDir, "directoryiq-hero-image-failures.json"), JSON.stringify(imageFailures, null, 2), "utf8");
    const fatalConsoleErrors = consoleErrors.filter((entry) => !isIgnorableConsoleError(entry));
    expect(fatalConsoleErrors).toEqual([]);
    expect(imageFailures).toEqual([]);
  });
});
