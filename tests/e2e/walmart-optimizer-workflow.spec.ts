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
    await expect(page.getByTestId("ecomviper-walmart-product-optimizer-summary")).toContainText("Listing Quality Score");
    await expect(page.getByTestId("ecomviper-walmart-ai-recommendations")).toContainText(
      "AI recommendation unavailable until provider is connected"
    );
    await expect(page.getByTestId("ecomviper-walmart-ai-recommendations")).not.toContainText("Open AI Optimizer");
    await expect(page.getByTestId("ecomviper-walmart-ai-recommendations")).toContainText(
      "Deterministic recommendation"
    );
    await expect(page.getByTestId("ecomviper-walmart-staged-changes")).toContainText("Staged changes");
    await expect(page.getByTestId("ecomviper-walmart-ai-recommendations")).toContainText(
      "Not submitted to Walmart. Human approval required before feed submission."
    );

    await page.getByRole("button", { name: "Stage Deterministic Recommendations" }).click();
    await expect(
      page.getByText("Deterministic recommendations staged. No live Walmart feed submission was performed.")
    ).toBeVisible();
  });
});
