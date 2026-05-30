export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { runRocktomicSourceSync } from "@/lib/ecomviper/dropshipping/rocktomic-source-ingestion";
import { GLOBAL_SUPPLIER_SCOPE_USER_ID } from "@/lib/ecomviper/dropshipping/rocktomic-normalized-store";

interface Body {
  userId?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getBearerToken(req: NextRequest): string {
  const raw = req.headers.get("authorization") || "";
  const matched = raw.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || "";
}

function resolveInternalUserId(req: NextRequest, body: Body): string | null {
  const explicit = asString(body.userId) || asString(req.headers.get("x-ecomviper-sync-user-id"));
  if (explicit) return explicit;
  const envFallback = asString(process.env.ECOMVIPER_SYNC_DEFAULT_USER_ID);
  return envFallback || GLOBAL_SUPPLIER_SCOPE_USER_ID;
}

export async function POST(req: NextRequest) {
  try {
    const internalToken = asString(process.env.ECOMVIPER_SYNC_INTERNAL_TOKEN);
    const bearer = getBearerToken(req);
    const body = (await req.json().catch(() => ({}))) as Body;

    let userId: string | null = null;

    if (internalToken && bearer && bearer === internalToken) {
      userId = resolveInternalUserId(req, body);
    } else {
      const auth = await requireSignedInUser();
      if (auth.unauthorizedResponse) return auth.unauthorizedResponse;
      userId = auth.userId || null;
      if (!userId) {
        return fail(401, "Please sign in before running supplier source sync.", "UNAUTHORIZED");
      }
    }

    if (!userId) {
      return fail(401, "Please sign in before running supplier source sync.", "UNAUTHORIZED");
    }

    const startedAt = Date.now();
    const snapshot = await runRocktomicSourceSync({
      userId,
      triggerKind: internalToken && bearer === internalToken ? "cli" : "api",
    });

    return ok({
      ok: true,
      supplier: snapshot.supplier,
      syncStatus: snapshot.syncStatus,
      durationMs: Date.now() - startedAt,
      lastAttemptedSyncAt: snapshot.lastAttemptedSyncAt,
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
      lastSyncError: snapshot.lastSyncError,
      productsParsedCount: snapshot.syncRunSummary?.productsParsedCount ?? snapshot.productCount,
      inventoryRecordsParsedCount: snapshot.syncRunSummary?.inventoryRecordsParsedCount ?? snapshot.inventorySkuCount,
      pricingRecordsParsedCount: snapshot.syncRunSummary?.pricingRecordsParsedCount ?? snapshot.catalogSkuCount,
      assetRecordsParsedCount: snapshot.syncRunSummary?.assetRecordsParsedCount ?? snapshot.catalogExtractedSkuCount,
      sourceDiagnostics: snapshot.sourceDiagnostics,
    });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Unexpected supplier source sync error."
    );
  }
}
