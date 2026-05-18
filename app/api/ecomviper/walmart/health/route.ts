export const runtime = "nodejs";

import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  buildWalmartAiVisibilityScoreFixture,
  type WalmartAiVisibilityScore,
} from "@/lib/ecomviper/walmart/walmart-ai-visibility-score";
import { getWalmartConnectionHealthForUser } from "@/lib/ecomviper/walmart/walmart-auth";
import { getWalmartDashboardSnapshotForUser } from "@/lib/ecomviper/walmart/walmart-products";

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
    let mode = health.summary.mode;
    let cards = {
      productsImported: 0,
      draftChanges: 0,
      feedErrors: 0,
      listingsNeedingAttention: {
        count: 0,
        categories: [] as string[],
      },
    };
    let aiVisibilityScore: WalmartAiVisibilityScore = {
      overall: 0,
      status: "unknown",
      dimensions: {},
      provenance: {
        source: "unknown",
      },
      recommendations: [],
    };

    try {
      const dashboard = await getWalmartDashboardSnapshotForUser(userId);
      mode = dashboard.mode;
      cards = {
        productsImported: dashboard.productsImported,
        draftChanges: dashboard.draftChanges,
        feedErrors: dashboard.feedErrors,
        listingsNeedingAttention: dashboard.listingsNeedingAttention,
      };
    } catch {
      // Connection status should still load even when dashboard metrics are unavailable.
    }

    try {
      aiVisibilityScore = buildWalmartAiVisibilityScoreFixture({
        provenanceSource: "derived",
      });
    } catch {
      // Keep health payload stable even when visibility fixture generation fails.
    }

    return ok({
      ok: true,
      mode,
      connectionHealth: health,
      cards,
      ai_visibility_score: aiVisibilityScore,
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load Walmart health.");
  }
}
