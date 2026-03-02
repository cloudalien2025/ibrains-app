import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "artifacts", "playwright");

test.describe("DirectoryIQ hero image resolution", () => {
  test("listing hero shows image or documented fallback", async ({ page }) => {
    await fs.mkdir(outDir, { recursive: true });
    const listingId = "321";
    const listingApiPattern = new RegExp(`/api/directoryiq/listings/${listingId}$`);
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Hotel Gasthof Gramshammer",
            listing_url: "https://example.com/listings/hotel-gasthof-gramshammer",
            mainImageUrl: null,
            mainImageSource: "missing",
            imageResolutionAttempts: ["user.profile_photo=null", "portfolio entries unavailable"],
          },
          evaluation: {
            totalScore: 74,
            scores: { structure: 72, clarity: 75, trust: 70, authority: 76, actionability: 77 },
            flags: {
              structuralGateActive: false,
              structuralHardFailActive: false,
              authorityCeilingActive: false,
              ambiguityPenaltyApplied: false,
              trustRiskCapActive: false,
            },
            caps: [],
            ambiguityPenalty: 0,
          },
          authority_posts: Array.from({ length: 4 }).map((_, index) => ({
            id: `post-${index + 1}`,
            slot: index + 1,
            type: "contextual_guide",
            title: "",
            focus_topic: "",
            status: "not_created",
            blog_to_listing_status: "missing",
            listing_to_blog_status: "missing",
            featured_image_url: null,
            published_url: null,
            updated_at: new Date().toISOString(),
          })),
          integrations: { brilliant_directories: true, openai: true },
        }),
      });
    });

    const listingResponse = page.waitForResponse((response) => listingApiPattern.test(response.url()));
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "networkidle" });
    await listingResponse;
    await expect(page.getByRole("heading", { name: "Authority Support" })).toBeVisible({ timeout: 20_000 });
    const hero = page.getByTestId("directoryiq-listing-hero");
    await expect(hero).toBeVisible({ timeout: 20_000 });
    await expect(hero.locator("h1")).toBeVisible();

    const image = hero.getByTestId("directoryiq-hero-image");
    const imageCount = await image.count();
    const fallbackVisible = await hero
      .getByText(/No main image available for this listing yet\./i)
      .first()
      .isVisible()
      .catch(() => false);

    if (imageCount > 0) {
      await expect(image.first()).toBeVisible();
    } else {
      expect(fallbackVisible, "Expected fallback message when image is unavailable").toBeTruthy();
    }

    await hero.screenshot({ path: path.join(outDir, `hero_${listingId}.png`) });
  });
});
