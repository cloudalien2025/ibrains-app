export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  createConnectedSite,
  runSitemapConnectionJob,
} from "@/app/api/connect/_utils/sitemapConnection";

type Body = {
  brain_id?: string;
  base_url?: string;
  sitemap_url_override?: string | null;
  use_decodo?: boolean;
  respect_robots?: boolean;
};

function isBrainId(value: string): value is "directoryiq" | "ecomviper" {
  return value === "directoryiq" || value === "ecomviper";
}

function normalizeBaseUrl(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.host}`;
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    if (!checkRateLimit(`connect:sitemap:${userId}`, 8, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please wait and retry." }, { status: 429 });
    }

    const body = (await req.json()) as Body;
    const brainId = (body.brain_id ?? "").trim().toLowerCase();
    if (!isBrainId(brainId)) {
      return NextResponse.json({ error: "brain_id must be directoryiq|ecomviper" }, { status: 400 });
    }

    const baseUrlRaw = (body.base_url ?? "").trim();
    if (!baseUrlRaw) {
      return NextResponse.json({ error: "base_url is required" }, { status: 400 });
    }

    const respectRobots = body.respect_robots !== false;
    const useDecodo = Boolean(body.use_decodo);
    const baseUrl = normalizeBaseUrl(baseUrlRaw);
    const sitemapOverride = (body.sitemap_url_override ?? "").trim() || null;

    const connectedSiteId = await createConnectedSite({
      userId,
      brainId,
      connectionType: "sitemap",
      baseUrl,
      sitemapUrlUsed: sitemapOverride,
      robotsTxtUrl: `${baseUrl}/robots.txt`,
      useDecodo,
      respectRobots,
    });

    setImmediate(() => {
      void runSitemapConnectionJob({
        userId,
        brainId,
        connectedSiteId,
        baseUrl,
        sitemapOverride,
        useDecodo,
        respectRobots,
      });
    });

    return NextResponse.json({
      connected_site_id: connectedSiteId,
      status: "updating",
      progress_stage: "discovering_sitemap",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sitemap connect error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
