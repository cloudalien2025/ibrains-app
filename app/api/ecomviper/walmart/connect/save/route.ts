export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import {
  disconnectWalmart,
  getWalmartConnectionHealth,
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
        ok: health.connectionStatus === "connected",
        action,
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
        connectionStatus: health.connectionStatus,
        summary: health.summary,
      });
    }

    if (action === "permissions") {
      const health = getWalmartConnectionHealth();
      return ok({
        ok: health.connectionStatus === "connected",
        action,
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
        permissions: getWalmartPermissionChecklist(),
        permissionChecks: health.summary.permissionChecks,
        diagnostic: health.summary.diagnostic,
        connectionStatus: health.connectionStatus,
        summary: health.summary,
        lastSuccessfulApiCall: health.lastSuccessfulApiCall,
      });
    }

    const health = action === "rotate" ? await rotateWalmartCredentials(body) : await saveWalmartConnection(body);

    return ok({
      ok: health.connectionStatus === "connected",
      action,
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
      connectionStatus: health.connectionStatus,
      summary: health.summary,
      lastSuccessfulApiCall: health.lastSuccessfulApiCall,
      message:
        health.connectionStatus === "connected"
          ? "Connected. Production OAuth token and safe read check succeeded."
          : health.lastApiError?.message ?? "Credential save completed with warnings.",
      securityNote: "Client secret and access token are never returned to the browser.",
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save Walmart connection.");
  }
}
