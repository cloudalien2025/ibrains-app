export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqOpenAiKey } from "@/app/api/directoryiq/_utils/integrations";
import { getListingEvaluation, saveAuthorityImage } from "@/app/api/directoryiq/_utils/selectionData";
import { normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import {
  AuthorityRouteError,
  authorityErrorResponse,
  authorityReqId,
  logAuthorityError,
  logAuthorityInfo,
} from "@/app/api/directoryiq/_utils/authorityErrors";
import { buildImagePrompt } from "@/lib/directoryiq/contentGovernance";
import { generateAuthorityImage, validateOpenAiKeyPresent } from "@/lib/openai/serverClient";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  let resolvedListingId = "unknown";
  let slotIndex = 0;
  const reqId = authorityReqId();
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId, slot } = await Promise.resolve(params);
    resolvedListingId = decodeURIComponent(listingId);
    slotIndex = normalizeSlot(slot);
    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "image",
      message: "request received",
    });

    const body = (await req.json().catch(() => ({}))) as { focus_topic?: string };
    const focusTopic = (body.focus_topic ?? "").trim();
    if (!focusTopic) {
      throw new AuthorityRouteError(400, "BAD_REQUEST", "Focus topic is required.");
    }

    const apiKey = validateOpenAiKeyPresent(await getDirectoryIqOpenAiKey(userId));

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing) {
      throw new AuthorityRouteError(404, "NOT_FOUND", "Listing not found.");
    }

    const prompt = buildImagePrompt({
      focusTopic,
      imageStylePreference: detail.settings.imageStylePreference,
    });

    const imageUrl = await generateAuthorityImage({ apiKey, prompt });

    await saveAuthorityImage(userId, resolvedListingId, slotIndex, {
      imagePrompt: prompt,
      imageUrl,
    });

    logAuthorityInfo({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex,
      action: "image",
      message: "featured image generated and persisted",
    });
    return NextResponse.json({ ok: true, reqId, featured_image_url: imageUrl, prompt });
  } catch (error) {
    logAuthorityError({
      reqId,
      listingId: resolvedListingId,
      slot: slotIndex || undefined,
      action: "image",
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
    const message = error instanceof Error ? error.message : "Unknown image generation error";
    return authorityErrorResponse({
      reqId,
      status: 500,
      message,
      code: "INTERNAL_ERROR",
    });
  }
}
