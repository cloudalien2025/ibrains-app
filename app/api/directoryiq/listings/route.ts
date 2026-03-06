export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAllListingsWithEvaluations } from "@/app/api/directoryiq/_utils/selectionData";
import { isAdminRequest, listBdSites } from "@/app/api/directoryiq/_utils/bdSites";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const siteParam = req.nextUrl.searchParams.get("site");
    const siteId = req.nextUrl.searchParams.get("site_id");
    const isAdmin = isAdminRequest(req);
    let siteIds: string[] | null = null;

    if (siteParam === "all") {
      if (!isAdmin) {
        return NextResponse.json({ ok: false, listings: [], error: "admin_only" }, { status: 403 });
      }
      const sites = await listBdSites(userId);
      siteIds = sites.map((site) => site.id);
    } else if (siteId) {
      siteIds = [siteId];
    } else {
      const sites = await listBdSites(userId);
      const enabled = sites.filter((site) => site.enabled);
      const first = enabled[0] ?? sites[0];
      if (first) siteIds = [first.id];
    }

    const result = await getAllListingsWithEvaluations(userId, siteIds);
    const listings = result.cards.map((card) => ({
      listing_id: card.listingId,
      listing_name: card.name,
      url: card.url,
      score: card.evaluation.totalScore,
      pillars: card.evaluation.scores,
      authority_status: card.authorityStatus.toLowerCase().replace(/\s+/g, "_"),
      trust_status: card.trustStatus.toLowerCase().replace(/\s+/g, "_"),
      last_optimized: card.lastOptimized,
      site_id: card.siteId ?? null,
      site_label: card.siteLabel ?? null,
    }));

    return NextResponse.json({
      ok: true,
      listings,
      readiness: result.readiness,
      pillar_averages: result.pillarAverages,
      vertical_detected: result.verticalDetected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load listings";
    return NextResponse.json({ ok: false, listings: [], error: message }, { status: 500 });
  }
}
