export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { normalizeWalmartProduct } from "@/lib/ecomviper/core/product-normalizer";
import { clearPersistedWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-draft-repository";
import { upsertWalmartDraftForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { assessWalmartListingQuality, buildDeterministicOptimizationProposal } from "@/lib/ecomviper/walmart/walmart-listing-quality";
import { toOptimizerDraftPayload } from "@/lib/ecomviper/walmart/walmart-optimizer-staging";
import { replaceWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { clearDrafts, clearFeeds } from "@/lib/ecomviper/walmart/walmart-store";

export async function POST(req: NextRequest) {
  if (process.env.E2E_MOCK_GRAPH !== "1") {
    return fail(404, "Not found.", "NOT_FOUND");
  }

  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse || !userId) {
    return fail(401, "Please sign in before seeding Walmart test data.", "UNAUTHORIZED");
  }

  const body = (await req.json().catch(() => ({}))) as { sku?: string };
  const requestedSku = typeof body.sku === "string" ? body.sku.trim() : "";
  const sku = requestedSku || "30066-841";

  clearDrafts();
  await clearPersistedWalmartDraftsForUser(userId);
  clearFeeds();

  const seededProduct = normalizeWalmartProduct({
    sku,
    title: "Walmart Daily Wellness Formula 120ct",
    brand: "Walmart Brand",
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

  await replaceWalmartProductsForUser({
    userId,
    products: [seededProduct],
    importedAt: new Date().toISOString(),
  });

  const assessment = assessWalmartListingQuality(seededProduct);
  const stagedProposal = {
    ...buildDeterministicOptimizationProposal(seededProduct, assessment),
    status: "staged" as const,
    updatedAt: new Date().toISOString(),
  };

  const draft = await upsertWalmartDraftForUser({
    userId,
    sku: seededProduct.sku,
    draftPayload: toOptimizerDraftPayload(stagedProposal),
    product: seededProduct,
  });

  return ok({
    ok: true,
    sku: seededProduct.sku,
    draftId: draft.id,
    message: "E2E Walmart optimizer seed data ready.",
  });
}
