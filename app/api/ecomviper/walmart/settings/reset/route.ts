export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { disconnectWalmart } from "@/lib/ecomviper/walmart/walmart-auth";
import { countActiveWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-drafts";
import { clearPersistedWalmartDraftsForUser } from "@/lib/ecomviper/walmart/walmart-draft-repository";
import { clearWalmartProductsForUser } from "@/lib/ecomviper/walmart/walmart-products";
import { clearDrafts } from "@/lib/ecomviper/walmart/walmart-store";

type ResetAction = "disconnect_marketplace" | "clear_products" | "reset_drafts";

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before running Walmart safety reset actions.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before running Walmart safety reset actions.", "UNAUTHORIZED");
    }

    const body = (await req.json().catch(() => ({}))) as { action?: ResetAction };

    if (body.action === "disconnect_marketplace") {
      const health = await disconnectWalmart(userId);
      return ok({ ok: true, action: body.action, connectionStatus: health.connectionStatus });
    }

    if (body.action === "clear_products") {
      const blockedDraftCount = await countActiveWalmartDraftsForUser(userId);
      if (blockedDraftCount > 0) {
        return NextResponse.json(
          {
            ok: false,
            action: body.action,
            clearedProductCount: 0,
            clearedImportStateCount: 0,
            clearedImageMetadataCount: 0,
            blockedDraftCount,
            error: {
              code: "ACTIVE_DRAFTS_BLOCK_CLEAR",
              message: `Cannot clear imported products while ${blockedDraftCount} active draft(s) exist. Reset or discard drafts first.`,
            },
          },
          { status: 409 }
        );
      }

      const cleared = await clearWalmartProductsForUser(userId);
      return ok({
        ok: true,
        action: body.action,
        ...cleared,
        blockedDraftCount: 0,
      });
    }

    if (body.action === "reset_drafts") {
      await clearPersistedWalmartDraftsForUser(userId);
      clearDrafts();
      return ok({ ok: true, action: body.action, clearedDraftCount: "all" });
    }

    return fail(400, "Invalid reset action.", "BAD_REQUEST");
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to process reset action.");
  }
}
