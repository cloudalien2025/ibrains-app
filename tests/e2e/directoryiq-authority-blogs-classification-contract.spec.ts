import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ authority blogs classification contract", () => {
  test("renders deterministic classification fields and supports filter/sort", async ({ page }) => {
    await page.route("**/api/directoryiq/authority/blogs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          blogs: [
            {
              blogNodeId: "1",
              blogExternalId: "blog-comparison",
              blogTitle: "Austria Haus vs Arrabelle",
              blogUrl: "https://example.com/blog/compare",
              extractedEntitiesCount: 2,
              linkedListingsCount: 2,
              unlinkedMentionsCount: 0,
              status: "green",
              entities: [],
              suggestedListingTargets: [],
              missingInternalLinksRecommendations: [],
              primary_type: "Comparison",
              intent_labels: ["Compare", "Choose"],
              confidence: "High",
              parent_pillar_id: null,
              dominant_listing_id: null,
              target_entity_ids: ["austria-haus", "arrabelle"],
              flywheel_status_by_target: [
                { target_entity_id: "austria-haus", status: "Connected" },
                { target_entity_id: "arrabelle", status: "Connected" },
              ],
              selection_value: "Very High",
              classification_reason: "Assigned Comparison because the title/body explicitly compare multiple alternatives.",
              review_candidate: false,
            },
            {
              blogNodeId: "2",
              blogExternalId: "blog-support",
              blogTitle: "Why Austria Haus is best",
              blogUrl: "https://example.com/blog/support",
              extractedEntitiesCount: 1,
              linkedListingsCount: 1,
              unlinkedMentionsCount: 0,
              status: "green",
              entities: [],
              suggestedListingTargets: [],
              missingInternalLinksRecommendations: [],
              primary_type: "Listing Support",
              intent_labels: ["Choose", "Book"],
              confidence: "High",
              parent_pillar_id: null,
              dominant_listing_id: "austria-haus",
              target_entity_ids: ["austria-haus"],
              flywheel_status_by_target: [{ target_entity_id: "austria-haus", status: "Selection Asset" }],
              selection_value: "Very High",
              classification_reason: "Assigned Listing Support because Austria Haus has the highest dominant listing score.",
              review_candidate: false,
            },
            {
              blogNodeId: "3",
              blogExternalId: "blog-review",
              blogTitle: "Random travel note",
              blogUrl: "https://example.com/blog/note",
              extractedEntitiesCount: 0,
              linkedListingsCount: 0,
              unlinkedMentionsCount: 0,
              status: "red",
              entities: [],
              suggestedListingTargets: [],
              missingInternalLinksRecommendations: [],
              primary_type: "Needs Review",
              intent_labels: [],
              confidence: "Low",
              parent_pillar_id: null,
              dominant_listing_id: null,
              target_entity_ids: [],
              flywheel_status_by_target: [],
              selection_value: "Low",
              classification_reason: "Assigned Needs Review because deterministic signals were insufficient.",
              review_candidate: true,
            },
          ],
        }),
      });
    });

    await page.goto("/directoryiq/authority/blogs", { waitUntil: "networkidle" });

    await expect(page.getByText("Deterministic post classification for selection-oriented authority signals.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Primary Type" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Selection Value" })).toBeVisible();
    await expect(page.getByTestId("authority-blog-row-blog-review")).toBeVisible();
    await expect(page.getByTestId("authority-blog-review-pill")).toHaveCount(1);

    await page.getByTestId("authority-blog-filter-primary-type").selectOption("Comparison");
    await expect(page.getByTestId("authority-blog-row-blog-comparison")).toBeVisible();
    await expect(page.getByTestId("authority-blog-row-blog-support")).toHaveCount(0);

    await page.getByTestId("authority-blog-filter-primary-type").selectOption("all");
    await page.getByTestId("authority-blog-filter-flywheel").selectOption("Selection Asset");
    await expect(page.getByTestId("authority-blog-row-blog-support")).toBeVisible();
    await expect(page.getByTestId("authority-blog-row-blog-comparison")).toHaveCount(0);

    await page.getByTestId("authority-blog-filter-flywheel").selectOption("all");
    await page.getByTestId("authority-blog-filter-confidence").selectOption("Low");
    await expect(page.getByTestId("authority-blog-row-blog-review")).toBeVisible();
    await expect(page.getByTestId("authority-blog-row-blog-support")).toHaveCount(0);

    await page.getByTestId("authority-blog-filter-confidence").selectOption("all");
    await page.getByTestId("authority-blog-sort").selectOption("title");
    const firstTitle = (await page.locator("tbody tr").first().innerText()).toLowerCase();
    expect(firstTitle).toContain("austria haus");
  });
});
