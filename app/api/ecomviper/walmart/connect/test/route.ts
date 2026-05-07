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
      safeReadStatus: health.summary.safeReadStatus,
      lastSuccessfulAuth: health.summary.lastSuccessfulAuth,
      lastSuccessfulRead: health.summary.lastSuccessfulRead,
      lastApiError: health.lastApiError,
      permissionChecks: health.summary.permissionChecks,
      diagnostic: health.summary.diagnostic,
      summary: health.summary,
      connectionStatus: health.connectionStatus,
      lastSuccessfulApiCall: health.lastSuccessfulApiCall,
      message:
        health.connectionStatus === "connected"
          ? "Connected. Production OAuth token and safe read check succeeded."
          : health.lastApiError?.message ?? "Connection test did not complete.",
      securityNote: "Client secret and access token are processed server-side and never returned.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to test Walmart connection.");
  }
}
