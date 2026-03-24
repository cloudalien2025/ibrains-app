export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import {
  getAuthorityPostBySlot,
  markAuthorityDraftFailure,
  markAuthorityReviewReady,
  readPersistedStep2State,
  upsertAuthorityPostDraft,
} from "@/app/api/directoryiq/_utils/selectionData";
import { normalizePostType, normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { AuthorityRouteError, authorityReqId } from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildGovernedPrompt, ensureContextualListingLink, validateDraftHtml } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { createDirectoryIqJob, runDirectoryIqJob } from "@/app/api/directoryiq/_utils/jobs";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";
import { getBdSite } from "@/app/api/directoryiq/_utils/bdSites";
import { buildListingFaqSupportEngine } from "@/lib/directoryiq/faq/engine";

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

function composeListingUrlFromSite(raw: Record<string, unknown>, siteBaseUrl: string): string {
  const base = asString(siteBaseUrl);
  if (!base) return "";

  const pathCandidates = [
    asString(raw.group_filename),
    asString(raw.path),
    asString(raw.url_path),
    asString(raw.slug),
    asString(raw.group_slug),
  ].filter(Boolean);

  for (const pathCandidate of pathCandidates) {
    const normalizedPath = pathCandidate.replace(/^\/+/, "");
    if (!normalizedPath) continue;
    try {
      return new URL(normalizedPath, `${base.replace(/\/+$/, "")}/`).toString();
    } catch {
      continue;
    }
  }

  return "";
}

function isFaqSupportIntent(input: {
  postType: string;
  focusTopic: string;
  title: string;
  step2Contract?: {
    mission_plan_slot?: Record<string, unknown>;
    support_brief?: Record<string, unknown>;
    seo_package?: Record<string, unknown>;
  };
}): boolean {
  const topic = `${input.focusTopic} ${input.title}`.toLowerCase();
  const slotId = asString(input.step2Contract?.mission_plan_slot?.slot_id).toLowerCase();
  const slotLabel = asString(input.step2Contract?.mission_plan_slot?.slot_label).toLowerCase();
  const supportBriefType = asString(input.step2Contract?.support_brief?.post_type).toLowerCase();

  if (slotId.includes("faq")) return true;
  if (slotLabel.includes("faq")) return true;
  if (supportBriefType.includes("faq")) return true;
  if (/(faq|questions|before booking|booking questions|support page|selection guide)/.test(topic)) return true;
  if ((input.postType === "contextual_guide" || input.postType === "persona_intent") && /(booking|fit|policy|check-in|check in)/.test(topic)) {
    return true;
  }
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  const reqId = authorityReqId();
  const { listingId, slot } = await Promise.resolve(params);
  const resolvedListingId = decodeURIComponent(listingId);
  let slotIndex: number;
  try {
    slotIndex = normalizeSlot(slot);
  } catch (error) {
    if (error instanceof AuthorityRouteError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code,
            reqId,
            details: error.details,
          },
        },
        { status: error.status }
      );
    }
    throw error;
  }
  const userId = await requireDirectoryIqWriteUser(req);
  const siteId = req.nextUrl.searchParams.get("site_id")?.trim() || null;

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

  const job = await createDirectoryIqJob({
    reqId,
    userId,
    kind: "step2.draft",
    listingId: resolvedListingId,
    siteId,
    slot: slotIndex,
  });

  runDirectoryIqJob(job, {
    routeOrigin: "directoryiq.authority.step2.draft",
    runtimeOwner: "directoryiq-api.ibrains.ai",
    startedStage: "generating",
    processor: async ({ setStage }) => {
      const postType = normalizePostType((body.type ?? "").trim());
      const focusTopic = (body.focus_topic ?? "").trim();
      const title = (body.title ?? "").trim();

      if (!focusTopic) {
        throw new AuthorityRouteError(400, "BAD_REQUEST", "Focus topic is required.");
      }

      const resolved = await resolveListingEvaluation({
        userId,
        listingId: resolvedListingId,
        siteId,
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
      const listingSourceId = listing.source_id;
      const failDraft = async (error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to generate content draft.";
        const code = error instanceof AuthorityRouteError ? error.code : "DRAFT_GENERATION_FAILED";
        await markAuthorityDraftFailure(userId, listingSourceId, slotIndex, { code, message });
      };
      const listingName = listing.title ?? listingSourceId;
      const canonicalFromListing = resolveCanonicalListingUrl(raw, listing.url);
      const step2ContractListingUrl = resolveStep2ContractListingUrl(body.step2_contract);
      let listingUrl = canonicalFromListing || step2ContractListingUrl;
      let listingUrlSource = canonicalFromListing ? "listing_fields" : step2ContractListingUrl ? "step2_contract" : "none";
      let composedFromSite = "";
      let siteBaseUrl = "";

      if (!listingUrl && resolved.siteId) {
        const site = await getBdSite(userId, resolved.siteId);
        siteBaseUrl = asString(site?.base_url);
        composedFromSite = composeListingUrlFromSite(raw, siteBaseUrl);
        if (composedFromSite) {
          listingUrl = composedFromSite;
          listingUrlSource = "site_base_composed";
        }
      }

      console.info("[authority-support]", {
        reqId,
        listingId: listingSourceId,
        slot: slotIndex,
        action: "draft",
        site_id: resolved.siteId ?? null,
        listingUrlResolution: {
          winner: listingUrlSource,
          composedUsed: Boolean(composedFromSite),
          considered: {
            raw_url: asString(raw.url) || null,
            raw_listing_url: asString(raw.listing_url) || null,
            raw_profile_url: asString(raw.profile_url) || null,
            raw_link: asString(raw.link) || null,
            raw_permalink: asString(raw.permalink) || null,
            raw_source_url: asString(raw.source_url) || null,
            listing_url_column: asString(listing.url) || null,
            step2_contract_listing_url: step2ContractListingUrl || null,
            site_base_url: siteBaseUrl || null,
            raw_group_filename: asString(raw.group_filename) || null,
            raw_path: asString(raw.path) || null,
            raw_url_path: asString(raw.url_path) || null,
            raw_slug: asString(raw.slug) || null,
            raw_group_slug: asString(raw.group_slug) || null,
          },
        },
      });

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

      let generatedHtml = "";
      let faqMetadata: Record<string, unknown> | null = null;
      const useFaqEngine = isFaqSupportIntent({
        postType,
        focusTopic,
        title,
        step2Contract: body.step2_contract,
      });

      if (useFaqEngine) {
        const listingType = asString(raw.listing_type) || asString(raw.category) || postType;
        const faqResult = buildListingFaqSupportEngine({
          listingId: listingSourceId,
          siteId: resolved.siteId ?? null,
          listingName,
          listingType,
          canonicalUrl: listingUrl,
          title: title || listingName,
          description: listingDescription,
          raw,
        });

        if (!faqResult.publish_gate_result.allowPublish) {
          throw new AuthorityRouteError(
            422,
            "FAQ_PUBLISH_GATE_BLOCKED",
            "FAQ draft blocked by quality gate.",
            faqResult.publish_gate_result.reasons.join("; ")
          );
        }

        generatedHtml = faqResult.rendered_html;
        faqMetadata = {
          faq_context_json: faqResult.context,
          resolved_intent_clusters_json: faqResult.resolved_intent_clusters,
          candidate_questions_json: faqResult.candidate_questions,
          selected_questions_json: faqResult.selected_questions,
          source_facts_json: faqResult.source_facts,
          fact_confidence_map_json: faqResult.fact_confidence_map,
          quality_score: Math.round(
            (faqResult.quality.listing_specificity +
              faqResult.quality.local_relevance +
              faqResult.quality.directness +
              faqResult.quality.factual_grounding +
              faqResult.quality.selection_intent_coverage +
              faqResult.quality.answer_completeness +
              faqResult.quality.internal_link_quality) /
              7
          ),
          generic_language_penalty_score: faqResult.quality.generic_language_penalty,
          publish_gate_result: faqResult.publish_gate_result,
          rendered_html: faqResult.rendered_html,
        };
      } else {
        const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));
        const prompt = buildGovernedPrompt({
          postType,
          listingTitle: listingName,
          listingUrl,
          listingDescription,
          focusTopic,
        });
        try {
          generatedHtml = await generateAuthorityDraft({ apiKey, prompt });
        } catch (error) {
          await failDraft(error);
          throw error;
        }
      }
      const generatedValidation = validateDraftHtml({ html: generatedHtml, listingUrl });
      await setStage("validating");
      const html = ensureContextualListingLink({
        html: generatedHtml,
        listingUrl,
        listingTitle: listingName,
        focusTopic,
      });
      const validation = validateDraftHtml({ html, listingUrl });
      console.info("[authority-support]", {
        reqId,
        listingId: listingSourceId,
        slot: slotIndex,
        action: "draft",
        listingUrlResolved: Boolean(listingUrl),
        generatedHasContextualListingLink: generatedValidation.hasContextualListingLink,
        finalHasContextualListingLink: validation.hasContextualListingLink,
        governanceErrors: validation.errors,
      });

      if (!validation.valid) {
        throw new AuthorityRouteError(
          422,
          "DRAFT_VALIDATION_FAILED",
          "Draft failed governance validation.",
          validation.errors.join(" ")
        );
      }

      await setStage("persisting");
      const existing = await getAuthorityPostBySlot(userId, listingSourceId, slotIndex);
      const previousStep2 = readPersistedStep2State(existing?.metadata_json);
      const nextDraftVersion = previousStep2.draft_version + 1;
      const invalidateApproval = previousStep2.review_status === "approved";
      await upsertAuthorityPostDraft(userId, listingSourceId, slotIndex, {
        type: postType,
        title: title || `${listingName}: ${focusTopic}`,
        focusTopic,
        draftMarkdown: html,
        draftHtml: html,
        blogToListingStatus: validation.hasContextualListingLink ? "linked" : "missing",
        metadata: {
          quality_score: typeof faqMetadata?.quality_score === "number" ? faqMetadata.quality_score : 72,
          generated_at: new Date().toISOString(),
          governance_passed: true,
          step2_contract: body.step2_contract ?? null,
          faq_generation: faqMetadata,
          step2_state: {
            ...previousStep2,
            draft_status: "ready",
            draft_version: nextDraftVersion,
            draft_generated_at: new Date().toISOString(),
            draft_last_error_code: null,
            draft_last_error_message: null,
            review_status: previousStep2.image_status === "ready" ? "ready" : "not_ready",
            approved_at: invalidateApproval ? null : previousStep2.approved_at,
            approved_snapshot_draft_version: invalidateApproval ? null : previousStep2.approved_snapshot_draft_version,
            approved_snapshot_image_version: invalidateApproval ? null : previousStep2.approved_snapshot_image_version,
            publish_status: "not_started",
            publish_last_error_code: null,
            publish_last_error_message: null,
            publish_last_req_id: null,
            publish_attempted_at: null,
            publish_completed_at: null,
            published_post_id: null,
            published_url: null,
          },
        },
      });
      await markAuthorityReviewReady(userId, listingSourceId, slotIndex);

      return {
        ok: true,
        reqId,
        slot: slotIndex,
        status: "draft",
        draft_html: html,
        blog_to_listing_status: validation.hasContextualListingLink ? "linked" : "missing",
      };
    },
  });

  return NextResponse.json(
    {
      jobId: job.id,
      reqId: job.reqId,
      acceptedAt: job.acceptedAt,
      status: job.status,
      statusEndpoint: `/api/directoryiq/jobs/${encodeURIComponent(job.id)}`,
    },
    { status: 202 }
  );
}
