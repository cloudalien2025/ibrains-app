import { expect, test } from "@playwright/test";

test.describe("Create Brain flow", () => {
  test("brains page shows create action", async ({ page }) => {
    await page.goto("/brains", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Create Brain" })).toBeVisible();
  });

  test("create dialog uses Topic label and valid slug helper", async ({ page }) => {
    await page.goto("/brains", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Create Brain" }).click();

    await expect(page.getByText("Topic", { exact: true })).toBeVisible();

    const slugInput = page.getByPlaceholder("directoryiq-pro");
    await slugInput.fill("directoryiq-pro");

    await expect(page.getByText("Saved as directoryiq-pro")).toBeVisible();
    await expect(page.getByText("Saved as invalid slug")).toHaveCount(0);
  });
});
