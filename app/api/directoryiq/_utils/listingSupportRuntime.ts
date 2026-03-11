import { NextRequest } from "next/server";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { getListingCurrentSupport, type ListingSupportModel } from "@/src/directoryiq/services/listingSupportService";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

export type SupportResolution = {
  support: ListingSupportModel;
  source: "local_support_service_v1" | "external_proxy_support_v1";
  fallbackApplied: boolean;
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

async function resolveLocalSupport(req: NextRequest, listingId: string): Promise<ListingSupportModel> {
  const tenantId = resolveUserId(req);
  const siteId = resolveSiteId(req);
  try {
    return await getListingCurrentSupport({
      tenantId,
      listingId,
      siteId,
      listingTitle: listingId,
      listingUrl: null,
    });
  } catch {
    return fallbackSupport(listingId, siteId);
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
  if (requestHost(req) === targetHost()) {
    const support = await resolveLocalSupport(req, resolvedListingId);
    return {
      support,
      source: "local_support_service_v1",
      fallbackApplied: false,
    };
  }

  const upstreamListingId = encodeURIComponent(resolvedListingId);
  const supportRes = await proxyDirectoryIqRead(req, `/api/directoryiq/listings/${upstreamListingId}/support`);
  const supportJson = (await supportRes.clone().json().catch(() => null)) as UpstreamSupportResponse | null;
  if (supportRes.ok && supportJson?.ok && supportJson.support) {
    return {
      support: supportJson.support,
      source: "external_proxy_support_v1",
      fallbackApplied: false,
    };
  }

  const support = await resolveLocalSupport(req, resolvedListingId);
  return {
    support,
    source: "local_support_service_v1",
    fallbackApplied: true,
    upstreamStatus: supportRes.status,
  };
}
