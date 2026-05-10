import { expect, test } from "@playwright/test";

test.describe("walmart optimizer authenticated workflow", () => {
  test("signed-in user can open products, click into optimizer, and stage locally", async ({ page, request }) => {
    const seedResponse = await request.post("/api/ecomviper/walmart/test-seed", {
      data: { sku: "30066-841" },
    });
    expect(seedResponse.ok()).toBe(true);

    await page.goto("/apps/ecomviper/walmart/products", { waitUntil: "networkidle" });
    await expect(page.getByTestId("ecomviper-walmart-products-page")).toBeVisible();

    await page.getByRole("link", { name: "30066-841" }).first().click();

    await expect(page).toHaveURL(/\/apps\/ecomviper\/walmart\/products\/30066-841$/);
    await expect(page.getByTestId("ecomviper-walmart-product-editor-page")).toBeVisible();
    await expect(page.getByTestId("ecomviper-walmart-primary-actions")).toContainText("Optimize with AI");
    await expect(page.getByTestId("ecomviper-walmart-product-optimizer-summary")).toContainText("Listing quality");
    await expect(page.getByTestId("ecomviper-walmart-inline-ai-panel")).toContainText(
      "Connect your OpenAI API key first to optimize this product."
    );
    await expect(page.getByTestId("ecomviper-walmart-staged-changes")).toContainText("Staged changes");
    await expect(page.getByTestId("ecomviper-walmart-inline-ai-panel")).toContainText(
      "Not submitted to Walmart. Human approval required before feed submission."
    );
    await expect(page.getByTestId("ecomviper-walmart-primary-actions")).not.toContainText("Preview + Validate");

    await page.getByRole("button", { name: "Optimize with AI" }).click();
    await expect(page).toHaveURL(/\/apps\/ecomviper\/walmart\/products\/30066-841$/);
    await expect(page.getByText("Connect your OpenAI API key first to optimize this product.")).toBeVisible();

    await page.getByRole("button", { name: "Stage non-AI recommendations" }).click();
    await expect(
      page.getByText("Non-AI recommendations staged. No live Walmart feed submission was performed.")
    ).toBeVisible();
  });
});
