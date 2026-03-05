import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import {
  computeListingMetrics,
  listListingReferrers,
  loadAnchorDiversityBreakdown,
} from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";
import { queryDb } from "@/src/directoryiq/repositories/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId } = await Promise.resolve(params);
    const tenantId = req.nextUrl.searchParams.get("tenantId") ?? "default";

    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });
    if (!gate.enabled) {
      return NextResponse.json(
        { ok: false, error: { message: "Graph integrity not enabled", code: gate.reason, reqId } },
        { status: 403 }
      );
    }

    const metrics = await computeListingMetrics({ tenantId, listingId });
    const referrers = await listListingReferrers({ tenantId, listingId, limit: 20 });
    const anchors = await loadAnchorDiversityBreakdown({ tenantId, listingId });

    const backlinks = await queryDb<{ blog_url: string; status: string }>(
      `
      SELECT blog_url, status
      FROM directoryiq_listing_backlinks
      WHERE tenant_id = $1 AND listing_id = $2
      ORDER BY updated_at DESC
      `,
      [tenantId, listingId]
    );

    return NextResponse.json({
      ok: true,
      reqId,
      listingId,
      metrics,
      referrers,
      backlinks,
      anchorBreakdown: anchors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load listing integrity";
    return NextResponse.json(
      {
        ok: false,
        error: { message, code: "INTERNAL_ERROR", reqId },
      },
      { status: 500 }
    );
  }
}
