import { expect, test } from "@playwright/test";

const MOBILE_ROUTES = [
  "/directoryiq",
  "/directoryiq/listings",
  "/directoryiq/listings/test-listing-id",
  "/directoryiq/authority",
  "/directoryiq/graph-integrity",
  "/directoryiq/signal-sources",
  "/directoryiq/versions",
  "/directoryiq/authority/blogs",
  "/directoryiq/authority/listings",
  "/directoryiq/authority/integrity",
  "/directoryiq/authority-support",
  "/directoryiq/authority/authority-support",
] as const;

test.describe("DirectoryIQ mobile header unification", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every representative DirectoryIQ route uses one shared mobile header with nav drawer", async ({ page }) => {
    for (const route of MOBILE_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      const mobileHeader = page.getByTestId("directoryiq-mobile-header");
      const trigger = page.getByTestId("directoryiq-mobile-menu-trigger");

      await expect(mobileHeader).toBeVisible();
      await expect(mobileHeader.getByText("DirectoryIQ")).toBeVisible();
      await expect(trigger).toBeVisible();
      await expect(page.getByRole("button", { name: "Toggle DirectoryIQ navigation" })).toHaveCount(1);

      await trigger.click({ force: true });
      if (!(await mobileHeader.getByRole("link", { name: "Dashboard" }).isVisible())) {
        await trigger.click({ force: true });
      }
      await expect(mobileHeader.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 10_000 });
      await expect(mobileHeader.getByRole("link", { name: "Listings" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "Authority" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "Graph Integrity" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "Connections" })).toBeVisible();
      await expect(mobileHeader.getByRole("link", { name: "History" })).toBeVisible();
      await trigger.click({ force: true });
      await expect(mobileHeader.getByRole("link", { name: "Dashboard" })).toBeHidden();
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/directoryiq/listings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("directoryiq-mobile-header")).toBeHidden();
    await expect(page.getByRole("button", { name: "Toggle DirectoryIQ navigation" })).toHaveCount(0);
  });
});
