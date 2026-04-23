import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { resolveUserFromHeaders } from "@/lib/auth/entitlements";
import { resolveGraphIntegrityGate } from "@/src/directoryiq/services/graphIntegrity/featureFlags";
import { queryDb } from "@/src/directoryiq/repositories/db";
import { computeBlogMetrics, recommendAnchorsForListing } from "@/src/directoryiq/services/graphIntegrity/integrityMetrics";
import { getCandidateAnchors, type ListingAnchorInput } from "@/src/directoryiq/services/graphIntegrity/anchorDiversity";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readListingAnchorInput(listingId: string, title: string | null, raw: Record<string, unknown> | null): ListingAnchorInput {
  const city = readString(raw?.city ?? raw?.listing_city ?? raw?.location_city);
  const region = readString(raw?.state ?? raw?.listing_state ?? raw?.region ?? raw?.province);
  const category = readString(raw?.category ?? raw?.category_name ?? raw?.primary_category ?? raw?.industry);
  const services = Array.isArray(raw?.services) ? (raw?.services as unknown[]).map(readString).filter(Boolean) : [];

  return {
    listingId,
    title: title ?? listingId,
    category: category || null,
    city: city || null,
    region: region || null,
    services: services.length > 0 ? services : null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ blogIdOrSlug: string }> | { blogIdOrSlug: string } }
) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { blogIdOrSlug } = await Promise.resolve(params);
    const tenantId = req.nextUrl.searchParams.get("tenantId") ?? "default";

    const user = resolveUserFromHeaders(req.headers);
    const gate = resolveGraphIntegrityGate({ tenantId, userFeatures: user.features as string[] | undefined });
    if (!gate.enabled) {
      return NextResponse.json(
        { ok: false, error: { message: "Graph integrity not enabled", code: gate.reason, reqId } },
        { status: 403 }
      );
    }

    const metrics = await computeBlogMetrics({ tenantId, blogIdOrSlug });

    const rows = await queryDb<{
      listing_id: string;
      listing_title: string | null;
      listing_url: string | null;
      raw_json: Record<string, unknown> | null;
    }>(
      `
      SELECT DISTINCT
        l.external_id AS listing_id,
        l.title AS listing_title,
        l.canonical_url AS listing_url,
        dn.raw_json
      FROM authority_graph_edges e
      JOIN authority_graph_nodes b ON b.id = e.from_node_id
      JOIN authority_graph_nodes l ON l.id = e.to_node_id
      LEFT JOIN directoryiq_nodes dn ON dn.source_id = l.external_id AND dn.source_type = 'listing'
      WHERE e.tenant_id = $1
        AND b.node_type = 'blog_post'
        AND (b.id::text = $2 OR b.external_id = $2 OR b.canonical_url = $2)
        AND e.edge_type IN ('internal_link','weak_anchor')
      `,
      [tenantId, blogIdOrSlug]
    );

    const recommendations = [] as Array<{
      listing_id: string;
      listing_title: string | null;
      listing_url: string | null;
      recommended_anchor: string;
    }>;

    for (const row of rows) {
      const listingInput = readListingAnchorInput(row.listing_id, row.listing_title, row.raw_json);
      const candidates = getCandidateAnchors(listingInput);
      const recommendation = await recommendAnchorsForListing({
        tenantId,
        listingId: row.listing_id,
        listingTitle: listingInput.title,
        blogUrl: blogIdOrSlug,
        candidates,
      });
      recommendations.push({
        listing_id: row.listing_id,
        listing_title: row.listing_title,
        listing_url: row.listing_url,
        recommended_anchor: recommendation.anchor,
      });
    }

    return NextResponse.json({
      ok: true,
      reqId,
      metrics,
      recommendations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load blog integrity";
    return NextResponse.json(
      {
        ok: false,
        error: { message, code: "INTERNAL_ERROR", reqId },
      },
      { status: 500 }
    );
  }
}
