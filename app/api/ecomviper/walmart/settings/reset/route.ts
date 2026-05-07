export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { clearDrafts, clearMockProducts } from "@/lib/ecomviper/walmart/walmart-mock-data";
import { disconnectWalmart } from "@/lib/ecomviper/walmart/walmart-auth";

type ResetAction = "disconnect_marketplace" | "clear_products" | "reset_drafts";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as { action?: ResetAction };

    if (body.action === "disconnect_marketplace") {
      const health = disconnectWalmart();
      return ok({ ok: true, action: body.action, connectionStatus: health.connectionStatus });
    }

    if (body.action === "clear_products") {
      clearMockProducts();
      return ok({ ok: true, action: body.action });
    }

    if (body.action === "reset_drafts") {
      clearDrafts();
      return ok({ ok: true, action: body.action });
    }

    return fail(400, "Invalid reset action.", "BAD_REQUEST");
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to process reset action.");
  }
}
