import { expect, test } from "@playwright/test";

test.describe("walmart optimizer authenticated workflow", () => {
  test("signed-in user can open products, click into optimizer, and stage locally", async ({ page, request }) => {
    const seedResponse = await request.post("/api/ecomviper/walmart/test-seed", {
      data: { sku: "30066-841" },
    });
    expect(seedResponse.ok()).toBe(true);

    await page.goto("/optiwal/products", { waitUntil: "networkidle" });
    await expect(page.getByTestId("ecomviper-walmart-products-page")).toBeVisible();

    await page.getByRole("link", { name: "30066-841" }).first().click();

    await expect(page).toHaveURL(/\/optiwal\/products\/30066-841$/);
    await expect(page.getByTestId("ecomviper-walmart-product-editor-page")).toBeVisible();
    await expect(page.getByTestId("ecomviper-walmart-workflow-steps")).toContainText("1 Review");
    await expect(page.getByTestId("ecomviper-walmart-primary-actions")).toContainText(
      "Generate AI Improvements"
    );
    await expect(page.getByTestId("ecomviper-walmart-product-optimizer-summary")).toContainText("Listing quality");
    await expect(page.getByTestId("ecomviper-walmart-inline-ai-panel")).toContainText(
      "Optimize title, descriptions, bullets, and attributes without leaving this page."
    );
    await expect(page.getByTestId("ecomviper-walmart-staged-changes")).toContainText("Staged changes");
    await expect(page.getByTestId("ecomviper-walmart-primary-actions")).not.toContainText("Preview + Validate");

    await page.getByRole("button", { name: "Generate AI Improvements" }).click();
    await expect(page).toHaveURL(/\/optiwal\/products\/30066-841$/);
    await expect(page.getByText("Connect your OpenAI API key first to optimize this product.")).toBeVisible();
  });
});
