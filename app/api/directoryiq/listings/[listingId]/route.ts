export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

type ListingDetailPayload = {
  listing: {
    listing_id: string;
    listing_name: string;
    listing_url: string | null;
    mainImageUrl: string | null;
  };
  evaluation: {
    totalScore: number;
  };
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function imageFromRaw(raw: Record<string, unknown>): string | null {
  const value =
    asString(raw.mainImageUrl) ||
    asString(raw.main_image_url) ||
    asString(raw.image_url) ||
    asString(raw.featured_image_url) ||
    asString(raw.photo_url) ||
    asString(raw.group_photo);
  return value || null;
}

async function resolveLocalListingDetail(req: NextRequest, listingId: string): Promise<ListingDetailPayload> {
  const userId = resolveUserId(req);
  const siteId = asString(req.nextUrl.searchParams.get("site_id"));
  const evaluationResult = await getListingEvaluation(userId, listingId, siteId || undefined);
  const listing = evaluationResult.listing;
  const raw = (listing?.raw_json ?? {}) as Record<string, unknown>;

  const listingIdFromRaw = asString(raw.listing_id) || listingId;
  const listingName = asString(raw.group_name) || asString(listing?.title) || listingIdFromRaw;
  const listingUrl = asString(raw.url) || asString(listing?.url) || null;

  return {
    listing: {
      listing_id: listingIdFromRaw,
      listing_name: listingName,
      listing_url: listingUrl,
      mainImageUrl: imageFromRaw(raw),
    },
    evaluation: {
      totalScore: evaluationResult.evaluation?.totalScore ?? 0,
    },
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const { listingId } = await Promise.resolve(params);
  const decodedListingId = decodeURIComponent(listingId);
  const upstreamListingId = encodeURIComponent(decodedListingId);

  if (requestHost(req) === targetHost()) {
    const payload = await resolveLocalListingDetail(req, decodedListingId);
    return NextResponse.json(payload, { status: 200 });
  }

  const upstream = await proxyDirectoryIqRead(req, `/api/directoryiq/listings/${upstreamListingId}`);
  const upstreamJson = (await upstream.clone().json().catch(() => null)) as { listing?: unknown } | null;
  if (upstream.ok && upstreamJson?.listing) {
    return upstream;
  }

  try {
    const payload = await resolveLocalListingDetail(req, decodedListingId);
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return upstream;
  }
}
