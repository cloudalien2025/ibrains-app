export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqBdConnection, getDirectoryIqOpenAiKey, getSerpApiKeyForUser } from "@/app/api/directoryiq/_utils/integrations";
import { getListingEvaluation, upsertAuthorityPostDraft } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizePostType, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import {
  AuthorityRouteError,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildGovernedPrompt, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { fetchTopSerpOrganicResults } from "@/app/api/directoryiq/_utils/serpapi";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveListingUrl(raw: Record<string, unknown>, fallbackBaseUrl: string): string {
  const directCandidates = [
    raw.url,
    raw.link,
    raw.group_url,
    raw.post_url,
    raw.website,
  ];
  for (const value of directCandidates) {
    const candidate = asString(value);
    if (/^https?:\/\//i.test(candidate)) return candidate;
    if (/^https?%3A%2F%2F/i.test(candidate)) {
      try {
        return decodeURIComponent(candidate);
      } catch {
        continue;
      }
    }
  }

  const pathCandidates = [raw.group_filename, raw.post_filename, raw.filename, raw.filename_hidden];
  const baseUrl = asString(fallbackBaseUrl);
  if (!baseUrl) return "";

  for (const value of pathCandidates) {
    const path = asString(value).replace(/^\/+/, "");
    if (!path) continue;
    try {
      return new URL(`/${path}`, baseUrl).toString();
    } catch {
      continue;
    }
  }

  return "";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  let resolvedListingId = "unknown";
  let slotIndex = 0;
  const reqId = authorityReqId();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId, slot } = await Promise.resolve(context.params);
    resolvedListingId = decodeURIComponent(listingId);
    slotIndex = normalizeSlot(slot);

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "draft",
      message: "request received",
    });

    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      focus_topic?: string;
      title?: string;
    };

    const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));
    const serpApiKey = await getSerpApiKeyForUser(userId);
    const serpapiMockEnabled = process.env.E2E_MOCK_SERPAPI === "1";

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const authorityPosts = Array.isArray(detail.authorityPosts) ? detail.authorityPosts : [];
    const sourcePost = authorityPosts.find((post) => post.slot_index === slotIndex);
    const listingName = detail.listing.title ?? detail.listing.source_id;
    const postType = normalizePostType((body.type ?? sourcePost?.post_type ?? "").trim());
    const focusTopic = (body.focus_topic ?? "").trim() || sourcePost?.focus_topic?.trim() || sourcePost?.title?.trim() || listingName;
    const title = (body.title ?? "").trim() || sourcePost?.title?.trim() || `${listingName}: ${focusTopic}`;
    if (!title) throw new AuthorityRouteError(400, "BAD_REQUEST", "Post title is required.");
    if (!focusTopic) throw new AuthorityRouteError(400, "BAD_REQUEST", "Focus topic is required.");

    const raw = (detail.listing.raw_json ?? {}) as Record<string, unknown>;
    const bdConnection = await getDirectoryIqBdConnection(userId);
    const fallbackBaseUrl = bdConnection?.baseUrl ?? process.env.DIRECTORYIQ_BD_BASE_URL ?? "";
    const listingUrl = asString(detail.listing.url) || resolveListingUrl(raw, fallbackBaseUrl);

    const listingDescription =
      (typeof raw.description === "string" && raw.description) ||
      (typeof raw.content === "string" && raw.content) ||
      "";

    let researchPack: Array<{
      position?: number;
      title?: string;
      link?: string;
      snippet?: string;
    }> = [];
    if (serpapiMockEnabled) {
      researchPack = Array.from({ length: 10 }).map((_, idx) => ({
        position: idx + 1,
        title: `${focusTopic} result ${idx + 1}`,
        link: `https://example.com/research/${idx + 1}`,
        snippet: `Mock research snippet ${idx + 1} for ${focusTopic}.`,
      }));
    } else if (serpApiKey?.trim()) {
      researchPack = await fetchTopSerpOrganicResults({
        apiKey: serpApiKey.trim(),
        query: focusTopic,
        num: 10,
      });
    }

    const prompt = buildGovernedPrompt({
      postType,
      listingTitle: listingName,
      listingUrl,
      listingDescription,
      focusTopic,
      researchPack,
    });

    const html = await generateAuthorityDraft({ apiKey, prompt });
    let finalHtml = html;
    let validation = validateDraftHtml({ html: finalHtml, listingUrl });
    const missingContextualLink = validation.errors.some((error) =>
      error.toLowerCase().includes("contextual in-body blog-to-listing hyperlink")
    );
    if (!validation.valid && missingContextualLink && listingUrl) {
      finalHtml = `${finalHtml}\n<p>To review availability, pricing context, and policy details, visit <a href="${listingUrl}">${listingName}</a> before making plans.</p>`;
      validation = validateDraftHtml({ html: finalHtml, listingUrl });
    }

    if (!validation.valid) {
      throw new AuthorityRouteError(
        422,
        "DRAFT_VALIDATION_FAILED",
        "Draft failed governance validation.",
        validation.errors.join(" ")
      );
    }

    await upsertAuthorityPostDraft(userId, resolvedListingId, slotIndex, {
      type: postType,
      title: title || `${listingName}: ${focusTopic}`,
      focusTopic,
      draftMarkdown: finalHtml,
      draftHtml: finalHtml,
      blogToListingStatus: validation.hasContextualListingLink ? "linked" : "missing",
      metadata: {
        quality_score: 72,
        generated_at: new Date().toISOString(),
        governance_passed: true,
        contextual_link_auto_inserted: finalHtml !== html,
        listing_url_resolved: listingUrl || null,
        serpapi_query: focusTopic,
        serpapi_results: researchPack,
      },
    });

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "draft",
      message: "draft generated and persisted",
    });

    return NextResponse.json({
      ok: true,
      reqId,
      slot: slotIndex,
      status: "draft",
      draftMarkdown: finalHtml,
      excerpt: finalHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
      seoTitle: title,
      seoDescription: finalHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155),
      outline: [],
      citations: researchPack.map((item) => item.link).filter(Boolean),
      draft_html: finalHtml,
      research_count: researchPack.length,
      blog_to_listing_status: validation.hasContextualListingLink ? "linked" : "missing",
    });
  } catch (error) {
    logAuthorityError({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex || undefined,
      action: "draft",
      error,
    });

    if (error instanceof AuthorityRouteError) {
      return authorityErrorResponse({
        reqId,
        status: error.status,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown draft generation error";
    return authorityErrorResponse({
      reqId,
      status: 500,
      message,
      code: "INTERNAL_ERROR",
    });
  }
}
