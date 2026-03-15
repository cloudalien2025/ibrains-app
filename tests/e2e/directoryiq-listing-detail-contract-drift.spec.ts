import { expect, test } from "@playwright/test";

const listingId = "321";
const imagePath = "/mock/listing-hero.svg";

test.describe("DirectoryIQ listing-detail contract drift", () => {
  test("renders canonical hero image and avoids false config warnings from Signal Sources canonical state", async ({ page }) => {
    let integrationsCalls = 0;

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
      integrationsCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "should not be called by listing-detail" }),
      });
    });

    await page.route("**/api/directoryiq/signal-sources", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connectors: [
            {
              connector_id: "brilliant_directories_api",
              connected: true,
              label: null,
              masked_secret: "****bd",
              updated_at: "2026-03-12T00:00:00.000Z",
              config: null,
            },
            {
              connector_id: "openai",
              connected: true,
              label: null,
              masked_secret: "****open",
              updated_at: "2026-03-12T00:00:00.000Z",
              config: null,
            },
          ],
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

    const heroNode = page.getByTestId("listing-hero-node");
    await expect(heroNode).toBeVisible();
    await expect(page.getByTestId("listing-hero-overlay")).toBeVisible();
    await expect(page.getByTestId("listing-hero-title")).toHaveText("Acme Plumbing");
    await expect(page.getByTestId("listing-hero-url")).toHaveText("https://example.com/listings/acme-plumbing");
    await expect(page.getByTestId("listing-hero-score")).toContainText("AI Selection Score:");
    await expect(page.getByTestId("listing-hero-score")).not.toContainText("AI Visibility Score / AI Selection");
    const heroImage = heroNode.locator("img");
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute("src", imagePath);
    await expect(page.getByText("AI connection not configured.")).toHaveCount(0);
    await expect(page.getByText("Website connection not configured.")).toHaveCount(0);
    await expect(page.getByText("AI Connected")).toHaveCount(0);
    await expect(page.getByText("Website Connected")).toHaveCount(0);
    expect(integrationsCalls).toBe(0);
  });
});
