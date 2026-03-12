import { expect, test } from "@playwright/test";

const listingId = "321";
const imagePath = "/mock/listing-hero.svg";

test.describe("DirectoryIQ listing-detail contract drift", () => {
  test("renders canonical hero image and avoids false config warnings when integration contract is healthy", async ({ page }) => {
    await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Acme Plumbing",
            listing_url: "https://example.com/listings/acme-plumbing",
            mainImageUrl: imagePath,
          },
          evaluation: {
            totalScore: 78,
          },
        }),
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listing: {
            listing_id: listingId,
            listing_name: "Acme Plumbing",
            listing_url: "https://example.com/listings/acme-plumbing",
            mainImageUrl: imagePath,
          },
          evaluation: {
            totalScore: 78,
          },
        }),
      });
    });

    await page.route("**/api/directoryiq/integrations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          openaiConfigured: true,
          bdConfigured: true,
          integrations: [],
        }),
      });
    });

    await page.route("**/mock/listing-hero.svg", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#0ea5e9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="28">Listing Hero</text></svg>`,
      });
    });

    await page.route(`**/api/directoryiq/listings/${listingId}/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });

    const heroImage = page.getByTestId("directoryiq-hero-image");
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute("src", imagePath);
    await expect(page.getByText("OpenAI not configured.")).toHaveCount(0);
    await expect(page.getByText("Brilliant Directories not configured.")).toHaveCount(0);
    await expect(page.getByText("OpenAI Connected")).toHaveCount(2);
    await expect(page.getByText("BD Connected")).toHaveCount(2);
  });
});
