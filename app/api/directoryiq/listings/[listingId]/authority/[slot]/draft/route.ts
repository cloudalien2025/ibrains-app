export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { upsertAuthorityPostDraft } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizePostType, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import {
  AuthorityRouteError,
  type AuthorityErrorCode,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildGovernedPrompt, ensureContextualListingLink, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { ListingSiteRequiredError, resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveCanonicalListingUrl(raw: Record<string, unknown>, fallback: unknown): string {
  return (
    asString(raw.url) ||
    asString(raw.listing_url) ||
    asString(raw.profile_url) ||
    asString(raw.link) ||
    asString(raw.permalink) ||
    asString(raw.source_url) ||
    asString(fallback)
  );
}

function resolveStep2ContractListingUrl(step2Contract: unknown): string {
  if (!step2Contract || typeof step2Contract !== "object" || Array.isArray(step2Contract)) return "";
  const missionPlanSlot = (step2Contract as { mission_plan_slot?: unknown }).mission_plan_slot;
  if (!missionPlanSlot || typeof missionPlanSlot !== "object" || Array.isArray(missionPlanSlot)) return "";
  return asString((missionPlanSlot as { listing_url?: unknown }).listing_url);
}

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
]);

const TRANSIENT_DB_ERROR_CODES = new Set(["57P01", "57P02", "57P03", "53300"]);

function toErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === "string" ? candidate.trim().toUpperCase() : "";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

function classifyTransientInfraError(error: unknown): {
  status: number;
  code: AuthorityErrorCode;
  message: string;
  details?: string;
  family: "db_timeout" | "db_connectivity" | "network_connectivity" | "internal";
} {
  const rawCode = toErrorCode(error);
  const rawMessage = toErrorMessage(error);
  const lower = rawMessage.toLowerCase();
  const syscall = typeof (error as { syscall?: unknown })?.syscall === "string" ? (error as { syscall: string }).syscall : undefined;
  const address = typeof (error as { address?: unknown })?.address === "string" ? (error as { address: string }).address : undefined;
  const port = typeof (error as { port?: unknown })?.port === "number" ? (error as { port: number }).port : undefined;

  const detailParts = [
    rawCode ? `code=${rawCode}` : "",
    syscall ? `syscall=${syscall}` : "",
    address ? `address=${address}` : "",
    typeof port === "number" ? `port=${port}` : "",
    rawMessage ? `message=${rawMessage}` : "",
  ].filter(Boolean);
  const details = detailParts.length ? detailParts.join(" | ") : undefined;

  const looksLikeTimeout = rawCode === "ETIMEDOUT" || lower.includes("timed out") || lower.includes("timeout");
  const looksLikeDb =
    lower.includes("database") ||
    lower.includes("postgres") ||
    lower.includes("pg:") ||
    lower.includes("relation ") ||
    lower.includes("connect etimedout");
  const looksLikeNetwork =
    TRANSIENT_NETWORK_ERROR_CODES.has(rawCode) ||
    lower.includes("socket") ||
    lower.includes("connect ") ||
    lower.includes("connection refused") ||
    lower.includes("getaddrinfo") ||
    lower.includes("dns");
  const looksLikeDbTransient = TRANSIENT_DB_ERROR_CODES.has(rawCode);

  if (looksLikeTimeout && looksLikeDb) {
    return {
      status: 503,
      code: "DB_TIMEOUT",
      message: "Article generation is temporarily unavailable. Please try again.",
      details,
      family: "db_timeout",
    };
  }

  if (looksLikeDbTransient || (looksLikeDb && looksLikeNetwork)) {
    return {
      status: 503,
      code: "DB_CONNECTIVITY",
      message: "Article generation is temporarily unavailable. Please try again.",
      details,
      family: "db_connectivity",
    };
  }

  if (looksLikeTimeout || looksLikeNetwork) {
    return {
      status: 503,
      code: "NETWORK_CONNECTIVITY",
      message: "We couldn't reach a required service. Please try again.",
      details,
      family: "network_connectivity",
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Article generation is temporarily unavailable. Please try again.",
    details,
    family: "internal",
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  let resolvedListingId = "unknown";
  let slotIndex = 0;
  let resolvedSiteId: string | null = null;
  let listingSourceId = "unknown";
  const reqId = authorityReqId();
  const routeOrigin = "directoryiq.authority.step2.draft";

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId, slot } = await Promise.resolve(params);
    resolvedListingId = decodeURIComponent(listingId);
    slotIndex = normalizeSlot(slot);
    resolvedSiteId = req.nextUrl.searchParams.get("site_id")?.trim() || null;

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "draft",
      message: "request received",
    });
    console.info("[directoryiq-step2-draft]", {
      event: "request_received",
      reqId,
      routeOrigin,
      listingId: resolvedListingId,
      slot: slotIndex,
      site_id: resolvedSiteId,
      localCanonicalPath: true,
    });

    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      focus_topic?: string;
      title?: string;
      step2_contract?: {
        mission_plan_slot?: Record<string, unknown>;
        support_brief?: Record<string, unknown>;
        seo_package?: Record<string, unknown>;
      };
    };

    const postType = normalizePostType((body.type ?? "").trim());
    const focusTopic = (body.focus_topic ?? "").trim();
    const title = (body.title ?? "").trim();

    if (!focusTopic) throw new AuthorityRouteError(400, "BAD_REQUEST", "Focus topic is required.");

    const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));

    const resolved = await resolveListingEvaluation({
      userId,
      listingId: resolvedListingId,
      siteId: resolvedSiteId,
    });
    if (!resolved || !resolved.listingEval.listing) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const detail = resolved.listingEval;
    const listing = detail.listing;
    if (!listing) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }
    const raw = (listing.raw_json ?? {}) as Record<string, unknown>;
    listingSourceId = listing.source_id;
    const listingName = listing.title ?? listingSourceId;
    const listingUrl =
      resolveCanonicalListingUrl(raw, listing.url) || resolveStep2ContractListingUrl(body.step2_contract);

    if (!listingUrl) {
      throw new AuthorityRouteError(
        400,
        "BAD_REQUEST",
        "Listing URL is required to enforce contextual blog-to-listing links."
      );
    }
    const listingDescription =
      (typeof raw.description === "string" && raw.description) ||
      (typeof raw.content === "string" && raw.content) ||
      "";

    const prompt = buildGovernedPrompt({
      postType,
      listingTitle: listingName,
      listingUrl,
      listingDescription,
      focusTopic,
    });

    const generatedHtml = await generateAuthorityDraft({ apiKey, prompt });
    const html = ensureContextualListingLink({
      html: generatedHtml,
      listingUrl,
      listingTitle: listingName,
      focusTopic,
    });
    const validation = validateDraftHtml({ html, listingUrl });

    if (!validation.valid) {
      throw new AuthorityRouteError(
        422,
        "DRAFT_VALIDATION_FAILED",
        "Draft failed governance validation.",
        validation.errors.join(" ")
      );
    }

    await upsertAuthorityPostDraft(userId, listingSourceId, slotIndex, {
      type: postType,
      title: title || `${listingName}: ${focusTopic}`,
      focusTopic,
      draftMarkdown: html,
      draftHtml: html,
      blogToListingStatus: validation.hasContextualListingLink ? "linked" : "missing",
      metadata: {
        quality_score: 72,
        generated_at: new Date().toISOString(),
        governance_passed: true,
        step2_contract: body.step2_contract ?? null,
      },
    });

    logAuthorityInfo({
      reqId,
      listingId: listingSourceId,
      slot: slotIndex,
      action: "draft",
      message: "draft generated and persisted",
    });
    console.info("[directoryiq-step2-draft]", {
      event: "draft_persisted",
      reqId,
      routeOrigin,
      listingId: listingSourceId,
      slot: slotIndex,
      site_id: resolvedSiteId,
      localCanonicalPath: true,
      codeFamily: "ok",
    });

    return NextResponse.json({
      ok: true,
      reqId,
      slot: slotIndex,
      status: "draft",
      draft_html: html,
      blog_to_listing_status: validation.hasContextualListingLink ? "linked" : "missing",
    });
  } catch (error) {
    if (error instanceof ListingSiteRequiredError) {
      console.error("[directoryiq-step2-draft]", {
        event: "request_failed",
        reqId,
        routeOrigin,
        listingId: resolvedListingId,
        slot: slotIndex || undefined,
        site_id: resolvedSiteId,
        localCanonicalPath: true,
        codeFamily: "bad_request",
        code: "BAD_REQUEST",
      });
      return authorityErrorResponse({
        reqId,
        status: 409,
        message: "Multiple sites contain this listing. Provide site_id.",
        code: "BAD_REQUEST",
        details: JSON.stringify(
          error.candidates.map((candidate) => ({
            site_id: candidate.siteId,
            site_label: candidate.siteLabel,
          }))
        ),
      });
    }
    logAuthorityError({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex || undefined,
      action: "draft",
      error,
    });

    if (error instanceof AuthorityRouteError) {
      console.error("[directoryiq-step2-draft]", {
        event: "request_failed",
        reqId,
        routeOrigin,
        listingId: listingSourceId !== "unknown" ? listingSourceId : resolvedListingId,
        slot: slotIndex || undefined,
        site_id: resolvedSiteId,
        localCanonicalPath: true,
        codeFamily: error.code === "DRAFT_VALIDATION_FAILED" ? "governance" : "validation",
        code: error.code,
      });
      return authorityErrorResponse({
        reqId,
        status: error.status,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const classified = classifyTransientInfraError(error);
    console.error("[directoryiq-step2-draft]", {
      event: "request_failed",
      reqId,
      routeOrigin,
      listingId: listingSourceId !== "unknown" ? listingSourceId : resolvedListingId,
      slot: slotIndex || undefined,
      site_id: resolvedSiteId,
      localCanonicalPath: true,
      codeFamily: classified.family,
      code: classified.code,
      details: classified.details,
    });
    return authorityErrorResponse({
      reqId,
      status: classified.status,
      message: classified.message,
      code: classified.code,
      details: classified.details,
    });
  }
}
