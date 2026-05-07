export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { getWalmartConnectionHealth } from "@/lib/ecomviper/walmart/walmart-auth";
import { getWalmartDashboardSnapshot } from "@/lib/ecomviper/walmart/walmart-products";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const health = getWalmartConnectionHealth();
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
