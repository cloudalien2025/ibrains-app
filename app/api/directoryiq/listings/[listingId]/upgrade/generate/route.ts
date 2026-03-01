export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import {
  createListingUpgradeDraft,
  extractListingDescription,
  getListingEvaluation,
} from "@/app/api/directoryiq/_utils/selectionData";
import { errorPayload, logUpgradeError, logUpgradeInfo, upgradeReqId } from "@/app/api/directoryiq/_utils/listingUpgrade";
import { buildListingUpgradePromptV1, outputHasBlockedPlaceholders } from "@/src/lib/prompts/directoryiq/listing_upgrade_v1";
import { generateListingUpgradeDraft, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";

function targetsFromGaps(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const rows: string[] = [];
  for (const field of ["structure", "clarity", "trust", "authority", "actionability"]) {
    const entries = (value as Record<string, unknown>)[field];
    if (!Array.isArray(entries)) continue;
    for (const item of entries) {
      if (typeof item === "string" && item.trim()) rows.push(item.trim());
    }
  }
  return rows;
}

function allowedFactsFromRaw(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    category: raw.group_category ?? raw.category ?? null,
    location: raw.post_location ?? raw.location ?? raw.city ?? raw.service_area ?? null,
    contact_phone: raw.phone ?? raw.phone1 ?? null,
    contact_email: raw.email ?? null,
    website: raw.website ?? null,
    credentials: [raw.license, raw.certification, raw.accreditation].filter(Boolean),
    reviews_count: raw.review_count ?? raw.reviews_count ?? null,
    average_rating: raw.average_rating ?? raw.rating ?? null,
  };
}

function mockUpgrade(originalDescription: string, listingName: string): string {
  const base = originalDescription.trim() || `${listingName} provides services tailored to local customer needs.`;
  return `${base}\n\nFor the fastest response, contact the business directly to confirm availability, service scope, and next steps.`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  let resolvedListingId = "unknown";
  const reqId = upgradeReqId();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { listingId } = await Promise.resolve(context.params);
    resolvedListingId = decodeURIComponent(listingId);

    logUpgradeInfo({ reqId, listingId: resolvedListingId, action: "generate", message: "request received" });

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing || !detail.evaluation) {
      const err = errorPayload({ status: 404, reqId, code: "NOT_FOUND", message: "Listing not found." });
      return NextResponse.json(err.body, { status: err.status });
    }

    const raw = (detail.listing.raw_json ?? {}) as Record<string, unknown>;
    const originalDescription = extractListingDescription(raw);
    const listingName = detail.listing.title ?? detail.listing.source_id;

    let proposedDescription = "";
    if (process.env.E2E_MOCK_OPENAI === "1") {
      proposedDescription = mockUpgrade(originalDescription, listingName);
    } else {
      const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));
      const prompt = buildListingUpgradePromptV1({
        listingName,
        listingUrl: detail.listing.url,
        originalDescription,
        allowedFacts: allowedFactsFromRaw(raw),
        targets: targetsFromGaps((detail.evaluation as Record<string, unknown>).gapsByPillar),
      });

      proposedDescription = await generateListingUpgradeDraft({ apiKey, prompt });
      if (outputHasBlockedPlaceholders(proposedDescription)) {
        const strictPrompt = `${prompt}\n\nRegeneration rule: do not output placeholders, brackets, or TBD tokens.`;
        proposedDescription = await generateListingUpgradeDraft({ apiKey, prompt: strictPrompt });
      }
      if (outputHasBlockedPlaceholders(proposedDescription)) {
        const err = errorPayload({
          status: 502,
          reqId,
          code: "OPENAI_UPSTREAM",
          message: "Generated output did not pass quality checks. Please retry.",
        });
        return NextResponse.json(err.body, { status: err.status });
      }
    }

    const created = await createListingUpgradeDraft({
      userId,
      listingId: resolvedListingId,
      createdByUserId: userId,
      originalDescription,
      proposedDescription,
    });

    logUpgradeInfo({ reqId, listingId: resolvedListingId, action: "generate", message: "draft created" });

    return NextResponse.json({
      draftId: created.id,
      proposedDescription,
      reqId,
    });
  } catch (error) {
    logUpgradeError({ reqId, listingId: resolvedListingId, action: "generate", error });
    const message = error instanceof Error ? error.message : "Unknown upgrade generation error";
    const code =
      message.includes("OpenAI API not configured") || message.includes("INTEGRATIONS_ENCRYPTION_KEY not configured")
        ? "OPENAI_KEY_MISSING"
        : "INTERNAL_ERROR";
    const status = code === "OPENAI_KEY_MISSING" ? 400 : 500;
    const err = errorPayload({
      status,
      reqId,
      code,
      message: code === "OPENAI_KEY_MISSING" ? "OpenAI API not configured. Go to DirectoryIQ -> Settings -> Integrations." : message,
    });
    return NextResponse.json(err.body, { status: err.status });
  }
}
