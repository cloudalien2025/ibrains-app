import { expect, test } from "@playwright/test";

test.describe("frontdoor launcher auth state", () => {
  test("app launcher shows the signed-in header state after refresh", async ({ page }) => {
    await page.goto("/brains", { waitUntil: "networkidle" });

    await expect(page.getByTestId("frontdoor-authenticated-state")).toHaveText("Signed in");
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Console", exact: true })).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByTestId("frontdoor-authenticated-state")).toHaveText("Signed in");
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveCount(0);
  });

  test("mobile launcher keeps the signed-in frontdoor header state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/brains", { waitUntil: "networkidle" });

    await expect(page.getByTestId("frontdoor-header-actions")).toBeVisible();
    await expect(page.getByTestId("frontdoor-authenticated-state")).toHaveText("Signed in");
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveCount(0);
  });
});
