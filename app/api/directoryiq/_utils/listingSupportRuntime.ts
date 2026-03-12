import { NextRequest } from "next/server";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { getListingCurrentSupport, type ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";
import { hasMaterialSupportSignals } from "@/src/directoryiq/services/listingSupportQuality";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

export type SupportResolution = {
  support: ListingSupportModel;
  source: "local_support_service_v1" | "external_proxy_support_v1";
  fallbackApplied: boolean;
  dataStatus: "supported" | "no_support_data";
  upstreamStatus?: number;
};

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

function resolveSiteId(req: NextRequest): string | null {
  const siteId = req.nextUrl.searchParams.get("site_id");
  return siteId && siteId.trim() ? siteId.trim() : null;
}

function fallbackSupport(listingId: string, siteId: string | null): ListingSupportModel {
  return {
    listing: {
      id: listingId,
      title: listingId,
      canonicalUrl: null,
      siteId,
    },
    summary: {
      inboundLinkedSupportCount: 0,
      mentionWithoutLinkCount: 0,
      outboundSupportLinkCount: 0,
      connectedSupportPageCount: 0,
      lastGraphRunAt: null,
    },
    inboundLinkedSupport: [],
    mentionsWithoutLinks: [],
    outboundSupportLinks: [],
    connectedSupportPages: [],
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripSitePrefix(input: string): string {
  const value = input.trim();
  if (!value.includes(":")) return value;
  const [, tail] = value.split(":", 2);
  return tail?.trim() || value;
}

async function resolveListingContext(
  req: NextRequest,
  listingId: string
): Promise<{
  listingId: string;
  sourceId: string | null;
  title: string;
  canonicalUrl: string | null;
  siteId: string | null;
}> {
  const siteId = resolveSiteId(req);
  const tenantId = resolveUserId(req);

  try {
    const resolved = await resolveListingEvaluation({
      userId: tenantId,
      listingId,
      siteId,
    });
    const listing = resolved?.listingEval.listing;
    const raw = (listing?.raw_json ?? {}) as Record<string, unknown>;
    const listingIdFromRaw = asString(raw.listing_id) || stripSitePrefix(listing?.source_id ?? listingId);
    const title = asString(raw.group_name) || asString(listing?.title) || listingIdFromRaw;
    const canonicalUrl = asString(raw.url) || asString(listing?.url) || null;
    return {
      listingId: listingIdFromRaw,
      sourceId: listing?.source_id ?? null,
      title,
      canonicalUrl,
      siteId: resolved?.siteId ?? siteId,
    };
  } catch {
    return {
      listingId: stripSitePrefix(listingId),
      sourceId: null,
      title: stripSitePrefix(listingId),
      canonicalUrl: null,
      siteId,
    };
  }
}

async function resolveLocalSupport(req: NextRequest, listingId: string): Promise<ListingSupportModel> {
  const tenantId = resolveUserId(req);
  const context = await resolveListingContext(req, listingId);
  const lookupIds = Array.from(
    new Set(
      [listingId, context.listingId, context.sourceId, context.siteId ? `${context.siteId}:${context.listingId}` : null]
        .map((value) => (value ?? "").trim())
        .filter(Boolean)
    )
  );

  try {
    return await getListingCurrentSupport({
      tenantId,
      listingId: context.listingId,
      listingLookupIds: lookupIds,
      siteId: context.siteId,
      listingTitle: context.title,
      listingUrl: context.canonicalUrl,
    });
  } catch {
    return fallbackSupport(context.listingId, context.siteId);
  }
}

type UpstreamSupportResponse = {
  ok?: boolean;
  support?: ListingSupportModel;
};

export async function resolveListingSupportModel(
  req: NextRequest,
  listingId: string
): Promise<SupportResolution> {
  const resolvedListingId = decodeURIComponent(listingId);
  const localSupport = await resolveLocalSupport(req, resolvedListingId);
  const localHasSignals = hasMaterialSupportSignals(localSupport);
  if (requestHost(req) === targetHost() || localHasSignals) {
    return {
      support: localSupport,
      source: "local_support_service_v1",
      fallbackApplied: false,
      dataStatus: localHasSignals ? "supported" : "no_support_data",
    };
  }

  const upstreamListingId = encodeURIComponent(resolvedListingId);
  const supportRes = await proxyDirectoryIqRead(req, `/api/directoryiq/listings/${upstreamListingId}/support`);
  const supportJson = (await supportRes.clone().json().catch(() => null)) as UpstreamSupportResponse | null;
  if (supportRes.ok && supportJson?.ok && supportJson.support) {
    const upstreamHasSignals = hasMaterialSupportSignals(supportJson.support);
    if (!upstreamHasSignals) {
      return {
        support: localSupport,
        source: "local_support_service_v1",
        fallbackApplied: true,
        dataStatus: localHasSignals ? "supported" : "no_support_data",
        upstreamStatus: supportRes.status,
      };
    }
    return {
      support: supportJson.support,
      source: "external_proxy_support_v1",
      fallbackApplied: false,
      dataStatus: "supported",
    };
  }

  return {
    support: localSupport,
    source: "local_support_service_v1",
    fallbackApplied: true,
    dataStatus: localHasSignals ? "supported" : "no_support_data",
    upstreamStatus: supportRes.status,
  };
}
