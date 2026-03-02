import { expect, test, type Page, type Route } from "@playwright/test";

const listingId = "3";
const slot = 1;

function listingPayload(input: { title: string; focusTopic: string; status?: "not_created" | "draft" | "published" }) {
  const status = input.status ?? "not_created";
  return {
    listing: {
      listing_id: listingId,
      listing_name: "Fixture Listing",
      listing_url: "https://example.com/listings/fixture-listing",
      mainImageUrl: null,
      mainImageSource: "missing",
      imageResolutionAttempts: [],
    },
    evaluation: {
      totalScore: 71,
      scores: { structure: 70, clarity: 69, trust: 72, authority: 73, actionability: 71 },
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
    authority_posts: [
      {
        id: "slot-1",
        slot: 1,
        type: "contextual_guide",
        title: input.title,
        focus_topic: input.focusTopic,
        status,
        blog_to_listing_status: "missing",
        listing_to_blog_status: "missing",
        featured_image_url: null,
        published_url: null,
        updated_at: new Date().toISOString(),
      },
      ...Array.from({ length: 3 }).map((_, idx) => ({
        id: `slot-${idx + 2}`,
        slot: idx + 2,
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
    ],
    integrations: { brilliant_directories: true, openai: true },
  };
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

function slotCard(page: Page) {
  return page.locator("article", { hasText: "Slot 1" }).first();
}

test.describe("DirectoryIQ Authority Support buttons", () => {
  test("validation boundary: Generate Draft shows validation with empty fields", async ({ page }) => {
    const listingApiPattern = new RegExp(`/api/directoryiq/listings/${listingId}$`);
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      await fulfillJson(route, listingPayload({ title: "", focusTopic: "" }));
    });

    const listingResponse = page.waitForResponse((response) => listingApiPattern.test(response.url()));
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "networkidle" });
    await listingResponse;
    await expect(page.getByRole("heading", { name: "Authority Support" })).toBeVisible({ timeout: 20_000 });
    const card = slotCard(page);
    await expect(card).toBeVisible({ timeout: 20_000 });

    await card.getByRole("button", { name: "Generate Draft" }).click();
    await expect(page.getByText(/Post title is required before generating a draft\./i)).toBeVisible();
  });

  test("deterministic success path: Generate Draft then Preview without typing", async ({ page }) => {
    const listingApiPattern = new RegExp(`/api/directoryiq/listings/${listingId}$`);
    let listingLoads = 0;
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      listingLoads += 1;
      if (listingLoads >= 2) {
        await fulfillJson(route, listingPayload({
          title: "Breckenridge Altitude Guide",
          focusTopic: "best time to visit breckenridge",
          status: "draft",
        }));
        return;
      }
      await fulfillJson(route, listingPayload({
        title: "Breckenridge Altitude Guide",
        focusTopic: "best time to visit breckenridge",
        status: "not_created",
      }));
    });

    await page.route(
      `**/api/directoryiq/listings/${listingId}/authority/${slot}/draft/generate`,
      async (route) => {
        await fulfillJson(route, { ok: true, status: "draft", research_count: 10 });
      }
    );
    await page.route(
      `**/api/directoryiq/listings/${listingId}/authority/${slot}/preview`,
      async (route) => {
        await fulfillJson(route, {
          preview: {
            listing_changes: [{ section: "Related Guides", before: "Before", after: "After" }],
            blog_changes: [{ section: "Authority Draft", before: "Before", after: "After" }],
            inserted_links: {
              blog_to_listing: { status: "linked", anchor_text: "Guide", location: "Body" },
              listing_to_blog: { status: "linked", placement: "Related Guides" },
            },
            score_delta: { before: 71, after: 76, cap_changes: [] },
          },
          approval_token: "token-1",
        });
      }
    );

    const listingResponse = page.waitForResponse((response) => listingApiPattern.test(response.url()));
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "networkidle" });
    await listingResponse;
    await expect(page.getByRole("heading", { name: "Authority Support" })).toBeVisible({ timeout: 20_000 });
    const card = slotCard(page);
    await expect(card).toBeVisible({ timeout: 20_000 });

    await card.getByRole("button", { name: "Generate Draft" }).click();
    await expect(page.getByText(/Research: Top 10 organic results fetched/i)).toBeVisible();

    await card.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Diff Preview")).toBeVisible();
  });

  test("publish requires explicit preview approval and sends approved=true", async ({ page }) => {
    const listingApiPattern = new RegExp(`/api/directoryiq/listings/${listingId}$`);
    let listingLoads = 0;
    await page.route(`**/api/directoryiq/listings/${listingId}`, async (route) => {
      listingLoads += 1;
      await fulfillJson(route, listingPayload({
        title: "Breckenridge Altitude Guide",
        focusTopic: "best time to visit breckenridge",
        status: listingLoads >= 2 ? "draft" : "not_created",
      }));
    });

    await page.route(
      `**/api/directoryiq/listings/${listingId}/authority/${slot}/draft/generate`,
      async (route) => {
        await fulfillJson(route, { ok: true, status: "draft", research_count: 10 });
      }
    );
    await page.route(
      `**/api/directoryiq/listings/${listingId}/authority/${slot}/preview`,
      async (route) => {
        await fulfillJson(route, {
          preview: {
            listing_changes: [{ section: "Related Guides", before: "Before", after: "After" }],
            blog_changes: [{ section: "Authority Draft", before: "Before", after: "After" }],
            inserted_links: {
              blog_to_listing: { status: "linked", anchor_text: "Guide", location: "Body" },
              listing_to_blog: { status: "missing", placement: "Related Guides" },
            },
            score_delta: { before: 71, after: 76, cap_changes: [] },
          },
          approval_token: "token-1",
        });
      }
    );

    let publishPayload: unknown = null;
    await page.route(
      `**/api/directoryiq/listings/${listingId}/authority/${slot}/publish`,
      async (route) => {
        publishPayload = route.request().postDataJSON();
        await fulfillJson(route, { ok: true, version_id: "v1" });
      }
    );

    const listingResponse = page.waitForResponse((response) => listingApiPattern.test(response.url()));
    await page.goto(`/directoryiq/listings/${listingId}`, { waitUntil: "networkidle" });
    await listingResponse;
    const card = slotCard(page);
    await expect(card).toBeVisible({ timeout: 20_000 });

    await expect(card.getByRole("button", { name: "Publish" })).toHaveCount(0);

    await card.getByRole("button", { name: "Generate Draft" }).click();
    await card.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Diff Preview")).toBeVisible();
    await page.getByRole("button", { name: "Approve & Publish" }).click();

    expect(publishPayload).toEqual({ approved: true, approval_token: "token-1" });
  });
});
