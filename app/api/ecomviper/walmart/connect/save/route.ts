export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import {
  disconnectWalmart,
  getWalmartPermissionChecklist,
  rotateWalmartCredentials,
  saveWalmartConnection,
} from "@/lib/ecomviper/walmart/walmart-auth";
import type { WalmartConnectionInput } from "@/lib/ecomviper/walmart/walmart-types";

type SaveAction = "save" | "rotate" | "disconnect" | "permissions";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as Partial<WalmartConnectionInput> & {
      action?: SaveAction;
    };

    const action = body.action ?? "save";

    if (action === "disconnect") {
      const health = disconnectWalmart();
      return ok({
        ok: true,
        action,
        connectionStatus: health.connectionStatus,
        summary: health.summary,
      });
    }

    if (action === "permissions") {
      return ok({
        ok: true,
        action,
        permissions: getWalmartPermissionChecklist(),
      });
    }

    const health = action === "rotate" ? await rotateWalmartCredentials(body) : await saveWalmartConnection(body);

    return ok({
      ok: true,
      action,
      connectionStatus: health.connectionStatus,
      summary: health.summary,
      lastSuccessfulApiCall: health.lastSuccessfulApiCall,
      lastApiError: health.lastApiError,
      securityNote: "Client secret is not returned and is never exposed to the browser.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save Walmart connection.");
  }
}
