export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { listWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";
import { filterWalmartProducts } from "@/lib/ecomviper/walmart/walmart-product-filters";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const search = req.nextUrl.searchParams.get("search") ?? "";
    const filter = req.nextUrl.searchParams.get("filter") ?? "all";

    const products = filterWalmartProducts(listWalmartProducts(), { query: search, filter });

    return ok({
      ok: true,
      mode: getWalmartRuntimeMode(),
      count: products.length,
      products,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to list Walmart products.");
  }
}
