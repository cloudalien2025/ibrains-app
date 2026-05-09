import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { assessWalmartListingQuality, buildDeterministicOptimizationProposal } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import { toOptimizerDraftPayload } from "@/lib/ecomviper/walmart/walmart-optimizer-staging";
import { listWalmartFeedSubmissions } from "@/lib/ecomviper/walmart/walmart-feeds";
import { clearDrafts, clearFeeds, replaceProducts } from "@/lib/ecomviper/walmart/walmart-store";
import type { WalmartDraftRecord } from "@/lib/ecomviper/walmart/walmart-types";
import { POST as createDraftRoute } from "@/app/api/ecomviper/walmart/drafts/route";
import { POST as submitFeedRoute } from "@/app/api/ecomviper/walmart/feeds/submit/route";

function seedProduct() {
  const product = normalizeWalmartProduct({
    sku: "30066-841",
    title: "Walmart Daily Wellness Formula 120ct",
    brand: "Walmart Brand",
    category: "Supplements",
    price: 19.99,
    inventoryQuantity: 12,
    inventoryStatus: "known",
    imageUrl: "",
    imageStatus: "catalog_missing",
    imageStatusMessage: "Image not provided by Walmart catalog",
    imageSource: "none",
    shortDescription: "Daily wellness support",
    description: "Daily wellness support formula with compliant catalog wording.",
    bulletPoints: ["Daily wellness support", "Quality ingredients", "Compliant listing structure"],
    attributes: { serving_size: "2 capsules", count: "120" },
  });

  replaceProducts([product], new Date().toISOString());
  return product;
}

async function createOptimizerDraft(status: "staged" | "approved"): Promise<WalmartDraftRecord> {
  const product = seedProduct();
  const assessment = assessWalmartListingQuality(product);
  const proposal = {
    ...buildDeterministicOptimizationProposal(product, assessment),
    status,
    updatedAt: new Date().toISOString(),
  };

  const response = await createDraftRoute(
    new NextRequest("http://localhost/api/ecomviper/walmart/drafts", {
      method: "POST",
      body: JSON.stringify({
        sku: product.sku,
        draftPayload: toOptimizerDraftPayload(proposal),
      }),
    })
  );

  expect(response.status).toBe(201);
  const payload = (await response.json()) as { draft: WalmartDraftRecord };
  return payload.draft;
}

describe("EcomViper Walmart optimizer approval gates", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ecomviper_walmart_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_activity_store__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_token_cache__ = undefined;
    (globalThis as Record<string, unknown>).__ecomviper_walmart_connection_fallback__ = undefined;
    clearDrafts();
    clearFeeds();
    delete process.env.WALMART_FEED_WRITE_ENABLED;
  });

  it("staging deterministic proposal keeps feed submissions untouched", async () => {
    await createOptimizerDraft("staged");
    expect(listWalmartFeedSubmissions()).toHaveLength(0);
  });

  it("approving proposal locally keeps feed submissions untouched", async () => {
    await createOptimizerDraft("approved");
    expect(listWalmartFeedSubmissions()).toHaveLength(0);
  });

  it("rejects feed submission when proposal is not approved", async () => {
    const stagedDraft = await createOptimizerDraft("staged");

    const response = await submitFeedRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/feeds/submit", {
        method: "POST",
        body: JSON.stringify({
          draftId: stagedDraft.id,
          approveSubmit: true,
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe("PROPOSAL_NOT_APPROVED");
    expect(listWalmartFeedSubmissions()).toHaveLength(0);
  });

  it("rejects feed submission when explicit approval click is missing", async () => {
    const approvedDraft = await createOptimizerDraft("approved");

    const response = await submitFeedRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/feeds/submit", {
        method: "POST",
        body: JSON.stringify({
          draftId: approvedDraft.id,
          approveSubmit: false,
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("APPROVAL_REQUIRED");
    expect(listWalmartFeedSubmissions()).toHaveLength(0);
  });

  it("rejects feed submission when write mode is disabled even after approval", async () => {
    const approvedDraft = await createOptimizerDraft("approved");

    const response = await submitFeedRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/feeds/submit", {
        method: "POST",
        body: JSON.stringify({
          draftId: approvedDraft.id,
          approveSubmit: true,
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.error?.code).toBe("WRITE_MODE_DISABLED");
    expect(listWalmartFeedSubmissions()).toHaveLength(0);
  });

  it("rejects submission when draft has no optimizer proposal payload", async () => {
    const product = seedProduct();
    const createResponse = await createDraftRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/drafts", {
        method: "POST",
        body: JSON.stringify({
          sku: product.sku,
          draftPayload: {
            price: 23.5,
          },
        }),
      })
    );

    const createPayload = (await createResponse.json()) as { draft: WalmartDraftRecord };

    const response = await submitFeedRoute(
      new NextRequest("http://localhost/api/ecomviper/walmart/feeds/submit", {
        method: "POST",
        body: JSON.stringify({
          draftId: createPayload.draft.id,
          approveSubmit: true,
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("PROPOSAL_REQUIRED");
  });
});
