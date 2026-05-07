export const runtime = "nodejs";

import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getWalmartConnectionHealthForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { getWalmartDashboardSnapshot } from "@/lib/ecomviper/walmart/walmart-products";

export async function GET() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) {
        return unauthorizedResponse;
      }
      return fail(401, "Please sign in before loading Walmart connection health.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before loading Walmart connection health.", "UNAUTHORIZED");
    }

    const health = await getWalmartConnectionHealthForUser(userId);
    const dashboard = getWalmartDashboardSnapshot();

    return ok({
      ok: true,
      mode: dashboard.mode,
      connectionHealth: health,
      cards: {
        productsImported: dashboard.productsImported,
        draftChanges: dashboard.draftChanges,
        feedErrors: dashboard.feedErrors,
        listingsNeedingAttention: dashboard.listingsNeedingAttention,
      },
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Walmart health.");
  }
}
