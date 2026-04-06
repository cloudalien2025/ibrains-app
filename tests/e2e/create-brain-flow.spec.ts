import { expect, test } from "@playwright/test";

test.describe("Create Brain flow", () => {
  test("brains page shows create action", async ({ page }) => {
    await page.goto("/brains", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Create Brain" })).toBeVisible();
  });
});
