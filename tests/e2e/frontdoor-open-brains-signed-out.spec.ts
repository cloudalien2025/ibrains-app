import { expect, test } from "@playwright/test";

test.describe("frontdoor open brains flow", () => {
  test("routes signed-out users to sign-in and signed-in users to brains", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const signInCtaCount = await page.getByRole("link", { name: "Sign in", exact: true }).count();

    if (signInCtaCount > 0) {
      await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Create account", exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Open Brains", exact: true }).click();
      await expect(page).toHaveURL(/\/sign-in\?redirect_url=.*\/brains/);
      await expect(page.getByText("Email address", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("invalid_host");
      return;
    }

    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("frontdoor-authenticated-state")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Brains", exact: true })).toHaveCount(1);
    await page.getByRole("link", { name: "Open Brains", exact: true }).click();
    await expect(page).toHaveURL(/\/brains/);
    await expect(page.getByRole("heading", { name: "My Brains", exact: true }).first()).toBeVisible();
  });
});
