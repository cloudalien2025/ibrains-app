import { expect, test } from "@playwright/test";

test.describe("DirectoryIQ authority blogs mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps blog rows and classification labels inside narrow viewport", async ({ page }) => {
    const longTitle = ("Things to Do in Vail in Summer " + "long editorial context ".repeat(14)).trim();
    const longUrl = `https://www.example.com/blog/${"very-long-url-segment-".repeat(12)}final`;

    await page.route("**/api/directoryiq/authority/blogs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          blogs: [
            {
              blogNodeId: "mobile-1",
              blogExternalId: "mobile-overflow-check",
              blogTitle: longTitle,
              blogUrl: longUrl,
              extractedEntitiesCount: 2,
              linkedListingsCount: 1,
              unlinkedMentionsCount: 0,
              status: "green",
              entities: [],
              suggestedListingTargets: [],
              missingInternalLinksRecommendations: [],
              primary_type: "Listing Support",
              intent_labels: ["Choose"],
              confidence: "High",
              parent_pillar_id: null,
              dominant_listing_id: "listing-1",
              target_entity_ids: ["listing-1"],
              flywheel_status_by_target: [{ target_entity_id: "listing-1", status: "Selection Asset" }],
              selection_value: "Very High",
              classification_reason: "Assigned Listing Support because deterministic listing signals were strong.",
              review_candidate: false,
            },
          ],
        }),
      });
    });

    await page.goto("/directoryiq/authority/blogs", { waitUntil: "networkidle" });

    const card = page.getByTestId("authority-blog-mobile-card-mobile-overflow-check");
    await expect(card).toBeVisible();
    await expect(card).toContainText(longTitle);
    await expect(card).toContainText(longUrl);
    await expect(card.getByTestId("authority-blog-mobile-classification")).toContainText("Type: Listing Support");
    await expect(card.getByTestId("authority-blog-mobile-classification")).toContainText("Confidence: High");
    await expect(card.getByTestId("authority-blog-mobile-classification")).toContainText("Selection: Very High");

    const overflow = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const root = document.documentElement;
      const body = document.body;
      const pageScrollWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="authority-blog-mobile-card-"]'));
      const labels = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="authority-blog-mobile-classification"]'));

      return {
        pageOverflow: pageScrollWidth > viewportWidth + 1,
        cardsOverflowViewport: cards.some((item) => item.getBoundingClientRect().right > viewportWidth + 1),
        cardsInternalOverflow: cards.some((item) => item.scrollWidth > item.clientWidth + 1),
        labelsOverflowViewport: labels.some((item) => item.getBoundingClientRect().right > viewportWidth + 1),
        labelsInternalOverflow: labels.some((item) => item.scrollWidth > item.clientWidth + 1),
      };
    });

    expect(overflow.pageOverflow).toBe(false);
    expect(overflow.cardsOverflowViewport).toBe(false);
    expect(overflow.cardsInternalOverflow).toBe(false);
    expect(overflow.labelsOverflowViewport).toBe(false);
    expect(overflow.labelsInternalOverflow).toBe(false);
  });
});
