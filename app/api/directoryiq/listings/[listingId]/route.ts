export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingEvaluation, readPersistedStep2State } from "@/app/api/directoryiq/_utils/selectionData";
import { resolveCanonicalListingUrl } from "@/app/api/directoryiq/_utils/canonicalListingUrl";
import { getDirectoryIqRuntimeStamp } from "@/app/api/directoryiq/_utils/runtimeStamp";
import {
  deriveStep2ResearchState,
  hasUsableStep2ResearchArtifact,
  type Step2ResearchState,
} from "@/lib/directoryiq/step2ResearchGateContract";

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
  step2: {
    research_state: Step2ResearchState;
    slots: Array<{
      slot: number;
      draft_html: string | null;
      featured_image_url: string | null;
      draft_status: "not_started" | "generating" | "ready" | "failed";
      image_status: "not_started" | "generating" | "ready" | "failed";
      review_status: "not_ready" | "ready" | "approved";
      publish_status: "not_started" | "publishing" | "published" | "failed";
      draft_version: number;
      image_version: number;
      step2_contract: Record<string, unknown> | null;
      step2_research_state: Step2ResearchState;
      updated_at: string | null;
    }>;
  };
  runtime: {
    runtime_owner: string;
    release_stamp: string;
  };
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function derivePersistedResearchStateFromPosts(
  slots: Array<{ step2_contract: Record<string, unknown> | null; step2_research_state: Step2ResearchState }>
): Step2ResearchState {
  if (slots.some((slot) => slot.step2_research_state === "ready_grounded")) return "ready_grounded";
  if (slots.some((slot) => slot.step2_research_state === "ready_thin" || slot.step2_research_state === "ready")) return "ready_thin";
  if (slots.some((slot) => slot.step2_research_state === "stale")) return "stale";
  if (slots.some((slot) => slot.step2_research_state === "researching")) return "researching";
  if (slots.some((slot) => slot.step2_research_state === "queued")) return "queued";
  if (slots.some((slot) => slot.step2_research_state === "failed")) return "failed";
  return "not_started";
}

function normalizePersistedResearchState(input: {
  requestedState: Step2ResearchState;
  step2Contract: Record<string, unknown>;
}): Step2ResearchState {
  if (input.requestedState === "ready_thin" || input.requestedState === "ready_grounded") {
    return input.requestedState;
  }

  return deriveStep2ResearchState({
    requestedState: input.requestedState,
    hasUsableResearchArtifact: hasUsableStep2ResearchArtifact(input.step2Contract.research_artifact),
    researchArtifact: input.step2Contract.research_artifact,
  });
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
  const readNestedImage = (value: unknown): string => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    return (
      asString((value as Record<string, unknown>).url) ||
      asString((value as Record<string, unknown>).src) ||
      asString((value as Record<string, unknown>).href) ||
      asString((value as Record<string, unknown>).image_url)
    );
  };

  const readFirstImage = (value: unknown): string => {
    if (!Array.isArray(value)) return "";
    for (const item of value) {
      const direct = asString(item);
      if (direct) return direct;
      const nested = readNestedImage(item);
      if (nested) return nested;
    }
    return "";
  };

  const value =
    asString(raw.mainImageUrl) ||
    asString(raw.main_image_url) ||
    asString(raw.main_image) ||
    asString(raw.image_url) ||
    asString(raw.featured_image_url) ||
    asString(raw.featured_image) ||
    asString(raw.hero_image) ||
    asString(raw.primary_image) ||
    asString(raw.photo_url) ||
    asString(raw.group_photo) ||
    readNestedImage(raw.main_image) ||
    readNestedImage(raw.featured_image) ||
    readNestedImage(raw.hero_image) ||
    readNestedImage(raw.primary_image) ||
    readFirstImage(raw.images) ||
    readFirstImage(raw.photos) ||
    readFirstImage(raw.gallery) ||
    readFirstImage(raw.photo_urls);
  return value || null;
}

function normalizeListingPayload(listingId: string, json: unknown): ListingDetailPayload | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const body = json as Record<string, unknown>;
  const listingCandidate = body.listing;
  if (!listingCandidate || typeof listingCandidate !== "object" || Array.isArray(listingCandidate)) return null;

  const raw = listingCandidate as Record<string, unknown>;
  const normalizedId = asString(raw.listing_id) || listingId;
  const normalizedName = asString(raw.listing_name) || asString(raw.group_name) || normalizedId;
  const normalizedUrl = resolveCanonicalListingUrl(raw, null);
  const evaluation =
    body.evaluation && typeof body.evaluation === "object" && !Array.isArray(body.evaluation)
      ? (body.evaluation as Record<string, unknown>)
      : null;
  const totalScoreRaw = evaluation?.totalScore;
  const totalScore = typeof totalScoreRaw === "number" && Number.isFinite(totalScoreRaw) ? totalScoreRaw : 0;

  return {
    listing: {
      listing_id: normalizedId,
      listing_name: normalizedName,
      listing_url: normalizedUrl,
      mainImageUrl: imageFromRaw(raw),
    },
    evaluation: {
      totalScore,
    },
    step2: {
      research_state: "not_started",
      slots: [],
    },
    runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
  };
}

async function resolveLocalListingDetail(req: NextRequest, listingId: string): Promise<ListingDetailPayload> {
  const userId = resolveUserId(req);
  const siteId = asString(req.nextUrl.searchParams.get("site_id"));
  const evaluationResult = await getListingEvaluation(userId, listingId, siteId || undefined);
  const listing = evaluationResult.listing;
  const raw = (listing?.raw_json ?? {}) as Record<string, unknown>;

  const listingIdFromRaw = asString(raw.listing_id) || listingId;
  const listingName = asString(raw.group_name) || asString(listing?.title) || listingIdFromRaw;
  const listingUrl = resolveCanonicalListingUrl(raw, listing?.url);
  const authorityPosts = Array.isArray(evaluationResult.authorityPosts) ? evaluationResult.authorityPosts : [];
  const step2Slots = authorityPosts.map((post) => {
    const metadata = asRecord(post.metadata_json);
    const step2State = readPersistedStep2State(metadata);
    const step2Contract = asRecord(metadata.step2_contract);
    const step2Research = asRecord(metadata.step2_research);
    const researchStateRaw = asString(step2Research.state);
    const requestedResearchState: Step2ResearchState =
      researchStateRaw === "queued" ||
      researchStateRaw === "researching" ||
      researchStateRaw === "ready" ||
      researchStateRaw === "ready_grounded" ||
      researchStateRaw === "ready_thin" ||
      researchStateRaw === "failed" ||
      researchStateRaw === "stale"
        ? researchStateRaw
        : "not_started";
    const step2ResearchState = normalizePersistedResearchState({
      requestedState: requestedResearchState,
      step2Contract,
    });
    return {
      slot: post.slot_index,
      draft_html: post.draft_html,
      featured_image_url: post.featured_image_url,
      draft_status: step2State.draft_status,
      image_status: step2State.image_status,
      review_status: step2State.review_status,
      publish_status: step2State.publish_status,
      draft_version: step2State.draft_version,
      image_version: step2State.image_version,
      step2_contract: Object.keys(step2Contract).length ? step2Contract : null,
      step2_research_state: step2ResearchState,
      updated_at: post.updated_at,
    };
  });
  const researchState = derivePersistedResearchStateFromPosts(step2Slots);

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
    step2: {
      research_state: researchState,
      slots: step2Slots,
    },
    runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
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
  const upstreamJson = await upstream.clone().json().catch(() => null);
  const normalizedUpstream = normalizeListingPayload(decodedListingId, upstreamJson);
  if (upstream.ok && normalizedUpstream) {
    return NextResponse.json(normalizedUpstream, {
      status: upstream.status,
      headers: {
        "cache-control": "no-store",
      },
    });
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
