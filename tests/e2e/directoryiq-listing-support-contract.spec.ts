import { expect, test } from "@playwright/test";

const listingId = "321";

const listingResponse = {
  listing: {
    listing_id: listingId,
    listing_name: "Acme Plumbing",
    listing_url: "https://example.com/listings/acme-plumbing",
    mainImageUrl: null,
  },
  evaluation: {
    totalScore: 78,
  },
};

const integrationsResponse = {
  openaiConfigured: true,
  bdConfigured: true,
};

test.describe("DirectoryIQ listing support contract", () => {
  test("renders canonical supported and intentional no-data support states", async ({ page }) => {
    await page.route(`**/api/directoryiq/listings/${listingId}?**`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
    });
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listingResponse) });
    });
    await page.route("**/api/directoryiq/integrations", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(integrationsResponse) });
    });
    const supportedBody = {
      ok: true,
      support: {
        listing: {
          id: listingId,
          title: "Acme Plumbing",
          canonicalUrl: "https://example.com/listings/acme-plumbing",
          siteId: "site-1",
        },
        summary: {
          inboundLinkedSupportCount: 1,
          mentionWithoutLinkCount: 1,
          outboundSupportLinkCount: 1,
          connectedSupportPageCount: 1,
          lastGraphRunAt: "2026-03-10T00:00:00.000Z",
        },
        inboundLinkedSupport: [
          {
            sourceId: "blog-1",
            sourceType: "blog_post",
            title: "How to choose a plumber",
            url: "https://example.com/blog/plumber-guide",
            anchors: ["Acme Plumbing"],
            relationshipType: "links_to_listing",
          },
        ],
        mentionsWithoutLinks: [
          {
            sourceId: "blog-2",
            sourceType: "blog_post",
            title: "Emergency plumbing checklist",
            url: "https://example.com/blog/emergency-checklist",
            mentionSnippet: "Acme Plumbing serves this area.",
            relationshipType: "mentions_without_link",
          },
        ],
        outboundSupportLinks: [
          {
            targetId: "blog-3",
            targetType: "blog_post",
            title: "Water heater tips",
            url: "https://example.com/blog/water-heater",
            relationshipType: "listing_links_out",
          },
        ],
        connectedSupportPages: [
          {
            id: "hub-1",
            type: "hub",
            title: "Plumbing · Austin",
            url: null,
          },
        ],
      },
      meta: {
        source: "first_party_graph_v1",
        evaluatedAt: "2026-03-10T00:00:01.000Z",
        dataStatus: "supported",
      },
    };
    await page.route(`**/api/directoryiq/listings/${listingId}/support**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(supportedBody),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "What's Helping" })).toBeVisible();
    await expect(page.getByText("How to choose a plumber")).toBeVisible();
    await expect(page.getByText("Emergency plumbing checklist")).toBeVisible();
    await expect(page.getByText("Water heater tips")).toBeVisible();
    await expect(page.getByText("Plumbing · Austin")).toBeVisible();
    await expect(page.getByText("Failed to load support model.")).toHaveCount(0);

    await page.unroute(`**/api/directoryiq/listings/${listingId}/support**`);
    await page.route(`**/api/directoryiq/listings/${listingId}/support**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          support: {
            listing: {
              id: listingId,
              title: "Acme Plumbing",
              canonicalUrl: "https://example.com/listings/acme-plumbing",
              siteId: "site-1",
            },
            summary: {
              inboundLinkedSupportCount: 0,
              mentionWithoutLinkCount: 0,
              outboundSupportLinkCount: 0,
              connectedSupportPageCount: 0,
              lastGraphRunAt: null,
            },
            inboundLinkedSupport: [],
            mentionsWithoutLinks: [],
            outboundSupportLinks: [],
            connectedSupportPages: [],
          },
          meta: {
            source: "first_party_graph_v1",
            evaluatedAt: "2026-03-10T00:00:01.000Z",
            dataStatus: "no_support_data",
          },
        }),
      });
    });

    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "What's Helping" })).toBeVisible();
    await expect(page.getByText("No inbound linked support detected yet.")).toBeVisible();
    await expect(page.getByText("No unlinked mentions detected yet.")).toBeVisible();
    await expect(page.getByText("No outbound support links detected yet.")).toBeVisible();
    await expect(page.getByText("Support diagnostics are not available yet.").first()).toBeVisible();
    await expect(page.getByText("Failed to load support model.")).toHaveCount(0);
  });
});
