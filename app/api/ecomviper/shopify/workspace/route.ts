export const runtime = "nodejs";

import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { buildShopifyAgenticWorkspaceStateForUser } from "@/lib/ecomviper/shopify/shopify-workspace-state";

export async function GET(req: Request) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse && unauthorizedResponse.status !== 401) {
      return unauthorizedResponse;
    }

    const url = new URL(req.url);
    const demoParam = (url.searchParams.get("demo") || "").trim().toLowerCase();
    const demoMode = demoParam === "1" || demoParam === "true" || demoParam === "demo";

    const workspace = await buildShopifyAgenticWorkspaceStateForUser({
      userId: userId || null,
      demoMode,
    });

    return ok({
      ok: true,
      provider: "shopify",
      workspace,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Shopify workspace state.");
  }
}
