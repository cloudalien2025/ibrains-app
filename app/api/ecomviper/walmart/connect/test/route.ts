export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { testWalmartConnection } from "@/lib/ecomviper/walmart/walmart-auth";
import type { WalmartConnectionInput } from "@/lib/ecomviper/walmart/walmart-types";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as Partial<WalmartConnectionInput>;
    const health = await testWalmartConnection(body);

    return ok({
      ok: health.connectionStatus === "connected",
      status: health.connectionStatus,
      environment: health.summary.environment,
      marketplaceRegion: health.summary.region,
      accountNickname: health.summary.accountNickname,
      maskedClientId: health.summary.maskedClientId,
      clientSecretStored: health.summary.clientSecretStored,
      tokenStatus: health.summary.tokenStatus,
      lastSuccessfulAuth: health.summary.lastSuccessfulAuth,
      lastApiError: health.lastApiError,
      permissionChecks: health.summary.permissionChecks,
      summary: health.summary,
      connectionStatus: health.connectionStatus,
      lastSuccessfulApiCall: health.lastSuccessfulApiCall,
      securityNote: "Client secret is processed server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to test Walmart connection.");
  }
}
