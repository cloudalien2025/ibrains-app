export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { listWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { mergeProductsWithLatestDrafts } from "@/lib/ecomviper/walmart/walmart-product-display";
import { listWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { filterWalmartProducts } from "@/lib/ecomviper/walmart/walmart-product-filters";

export async function GET(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before viewing Walmart products.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before viewing Walmart products.", "UNAUTHORIZED");
    }

    const search = req.nextUrl.searchParams.get("search") ?? "";
    const filter = req.nextUrl.searchParams.get("filter") ?? "all";

    const allProducts = await listWalmartProductsForUser(userId);
    const drafts = await listWalmartDraftsForUser(userId);
    const effectiveProducts = mergeProductsWithLatestDrafts({
      products: allProducts,
      drafts,
    });
    const products = filterWalmartProducts(effectiveProducts, { query: search, filter });

    return ok({
      ok: true,
      count: products.length,
      products,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to list Walmart products.");
  }
}
