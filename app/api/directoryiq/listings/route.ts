export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { getAllListingsWithEvaluations } from "@/app/api/directoryiq/_utils/selectionData";
import { query } from "@/app/api/ecomviper/_utils/db";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";

type ListingLike = Record<string, unknown> & {
  category?: unknown;
  group_category?: unknown;
  raw_json?: unknown;
};

type ListingCategoryRow = {
  source_id: string;
  bd_site_id: string | null;
  listing_id: string | null;
  group_category: string | null;
  category: string | null;
};

type LocalListingRow = {
  listing_id: string;
  listing_name: string;
  url: string;
  score: number;
  pillars: {
    structure: number;
    clarity: number;
    trust: number;
    authority: number;
    actionability: number;
  };
  authority_status: "strong" | "needs_support";
  trust_status: "strong" | "needs_trust";
  last_optimized: string | null;
  site_id: string | null;
  site_label: string | null;
  category: string | null;
  group_category: string | null;
};

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function withCanonicalCategory(row: unknown): unknown {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;

  const listing = row as ListingLike;
  const raw = listing.raw_json && typeof listing.raw_json === "object" && !Array.isArray(listing.raw_json) ? listing.raw_json : null;
  const category = firstNonEmptyString([
    listing.category,
    listing.group_category,
    (raw as Record<string, unknown> | null)?.group_category,
    (raw as Record<string, unknown> | null)?.category,
  ]);

  return {
    ...listing,
    category,
  };
}

function resolveDirectoryIqApiBase(): string {
  const raw = (
    process.env.DIRECTORYIQ_API_BASE ??
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE ??
    DEFAULT_DIRECTORYIQ_API_BASE
  )
    .trim()
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("DIRECTORYIQ_API_BASE must use http or https");
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid DIRECTORYIQ_API_BASE: ${error.message}`
        : "Invalid DIRECTORYIQ_API_BASE"
    );
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function requestHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded && forwarded.trim()) return normalizeHost(forwarded);
  const hostHeader = req.headers.get("host");
  if (hostHeader && hostHeader.trim()) return normalizeHost(hostHeader);
  return normalizeHost(req.nextUrl.host);
}

function targetHost(): string {
  return normalizeHost(new URL(resolveDirectoryIqApiBase()).host);
}

function resolveSiteFilter(req: NextRequest): string[] | null {
  const siteId = req.nextUrl.searchParams.get("site_id")?.trim() ?? "";
  if (siteId) return [siteId];
  const site = req.nextUrl.searchParams.get("site")?.trim().toLowerCase() ?? "";
  if (site === "all") return null;
  return null;
}

function listingIdFromRow(row: ListingCategoryRow): string {
  const direct = row.listing_id?.trim() ?? "";
  if (direct) return direct;
  const source = row.source_id.trim();
  const separator = source.indexOf(":");
  if (separator >= 0 && separator < source.length - 1) {
    return source.slice(separator + 1);
  }
  return source;
}

function listingSiteFromRow(row: ListingCategoryRow): string | null {
  const explicit = row.bd_site_id?.trim() ?? "";
  if (explicit) return explicit;
  const source = row.source_id.trim();
  const separator = source.indexOf(":");
  if (separator > 0) return source.slice(0, separator);
  return null;
}

function listingMapKey(siteId: string | null | undefined, listingId: string): string {
  return `${siteId ?? ""}:${listingId}`;
}

async function categoryMapForUser(userId: string, siteIds: string[] | null): Promise<Map<string, { category: string | null; group: string | null }>> {
  const rows = await query<ListingCategoryRow>(
    `
    SELECT
      source_id,
      bd_site_id,
      raw_json->>'listing_id' AS listing_id,
      raw_json->>'group_category' AS group_category,
      raw_json->>'category' AS category
    FROM directoryiq_nodes
    WHERE user_id = $1
      AND source_type = 'listing'
      AND ($2::uuid[] IS NULL OR bd_site_id = ANY($2::uuid[]))
    `,
    [userId, siteIds]
  );

  const map = new Map<string, { category: string | null; group: string | null }>();
  for (const row of rows) {
    const listingId = listingIdFromRow(row);
    if (!listingId) continue;
    const siteId = listingSiteFromRow(row);
    const group = firstNonEmptyString([row.group_category]);
    const category = firstNonEmptyString([row.group_category, row.category]);
    map.set(listingMapKey(siteId, listingId), { category, group });
  }
  return map;
}

async function buildLocalListingsPayload(req: NextRequest): Promise<NextResponse> {
  const userId = resolveUserId(req);
  const siteIds = resolveSiteFilter(req);
  const { cards } = await getAllListingsWithEvaluations(userId, siteIds);
  const categories = await categoryMapForUser(userId, siteIds);

  const listings: LocalListingRow[] = cards.map((card) => {
    const mapped = categories.get(listingMapKey(card.siteId ?? null, card.listingId)) ?? { category: null, group: null };
    return {
      listing_id: card.listingId,
      listing_name: card.name,
      url: card.url ?? "",
      score: Number((card.evaluation as { score?: number; totalScore?: number }).score ?? card.evaluation.totalScore ?? 0),
      pillars: card.evaluation.scores,
      authority_status: card.authorityStatus === "Strong" ? "strong" : "needs_support",
      trust_status: card.trustStatus === "Strong" ? "strong" : "needs_trust",
      last_optimized: card.lastOptimized ?? null,
      site_id: card.siteId ?? null,
      site_label: card.siteLabel ?? null,
      category: mapped.category,
      group_category: mapped.group,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      listings,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

export async function GET(req: NextRequest) {
  if (requestHost(req) === targetHost()) {
    try {
      return await buildLocalListingsPayload(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load listings";
      return NextResponse.json(
        {
          ok: false,
          error: message,
        },
        { status: 500 }
      );
    }
  }

  const upstream = await proxyDirectoryIqRead(req, "/api/directoryiq/listings");
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return upstream;

  try {
    const body = (await upstream.json()) as Record<string, unknown>;
    const listings = Array.isArray(body.listings) ? body.listings.map((row) => withCanonicalCategory(row)) : body.listings;
    const json = {
      ...body,
      listings,
    };
    return new NextResponse(JSON.stringify(json), {
      status: upstream.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return upstream;
  }
}
