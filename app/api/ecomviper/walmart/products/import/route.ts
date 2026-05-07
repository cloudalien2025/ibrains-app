export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { importWalmartProducts } from "@/lib/ecomviper/walmart/walmart-products";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const result = importWalmartProducts();
    return ok({
      ok: true,
      ...result,
      message:
        result.importedCount > 0
          ? `Imported ${result.importedCount} Walmart product(s).`
          : "No Walmart products imported yet. Production catalog read import is not configured.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to import Walmart products.");
  }
}
