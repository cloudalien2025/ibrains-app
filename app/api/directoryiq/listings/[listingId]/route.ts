export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getListingEvaluation } from "@/app/api/directoryiq/_utils/selectionData";
import { getDirectoryIqIntegration, getDirectoryIqIntegrationSecret } from "@/app/api/directoryiq/_utils/credentials";
import { normalizeBdBaseUrl } from "@/app/api/directoryiq/_utils/bdApi";
import { resolveMainListingImage } from "@/src/lib/bd/resolveMainListingImage";

function readFirstString(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readBaseUrl(meta: Record<string, unknown>): string | null {
  return readFirstString([meta.baseUrl, meta.base_url, process.env.DIRECTORYIQ_BD_BASE_URL]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isBdErrorPayload(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  const status = typeof payload.status === "string" ? payload.status.toLowerCase().trim() : "";
  return status === "error";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { listingId } = await Promise.resolve(context.params);
    const listingEval = await getListingEvaluation(userId, decodeURIComponent(listingId));
    const bdIntegration = await getDirectoryIqIntegration(userId, "brilliant_directories");
    const openAiIntegration = await getDirectoryIqIntegration(userId, "openai");
    const bdBaseUrl = readBaseUrl(bdIntegration.meta);
    let bdSecret: string | null = null;
    try {
      const row = await getDirectoryIqIntegrationSecret(userId, "brilliant_directories");
      bdSecret = row?.secret ?? null;
    } catch {
      bdSecret = null;
    }

    if (!listingEval.listing || !listingEval.evaluation) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const normalizedBaseUrl = bdBaseUrl ? normalizeBdBaseUrl(bdBaseUrl) : null;
    const listingRaw = asRecord(listingEval.listing.raw_json ?? {});
    const listingIdDecoded = decodeURIComponent(listingId);

    const fetchBdJson =
      normalizedBaseUrl && bdSecret
        ? async ({ method, path, form }: { method: "GET" | "POST"; path: string; form?: Record<string, string | number> }) => {
            const url = new URL(path, normalizedBaseUrl).toString();
            const response = await fetch(url, {
              method,
              headers: {
                "X-Api-Key": bdSecret,
                ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
              },
              body:
                method === "POST"
                  ? new URLSearchParams(
                      Object.entries(form ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
                        acc[key] = String(value);
                        return acc;
                      }, {})
                    ).toString()
                  : undefined,
              cache: "no-store",
            });
            const text = await response.text();
            try {
              return (text ? JSON.parse(text) : null) as Record<string, unknown> | null;
            } catch {
              return null;
            }
          }
        : undefined;

    const userGetByListingId = fetchBdJson
      ? await fetchBdJson({ method: "GET", path: `/api/v2/user/get/${encodeURIComponent(listingIdDecoded)}` })
      : null;

    const ownerUserId =
      (typeof listingRaw.user_id === "string" && listingRaw.user_id.trim()) ||
      (typeof listingRaw.user_id === "number" ? String(listingRaw.user_id) : "");

    const shouldFetchOwner =
      fetchBdJson && ownerUserId && (!userGetByListingId || isBdErrorPayload(userGetByListingId));

    const userGetByOwnerId = shouldFetchOwner
      ? await fetchBdJson({ method: "GET", path: `/api/v2/user/get/${encodeURIComponent(ownerUserId)}` })
      : null;

    const resolverPayload =
      Object.keys(listingRaw).length > 0
        ? listingRaw
        : (!isBdErrorPayload(userGetByListingId) ? userGetByListingId : userGetByOwnerId) ?? null;

    const mainImage = await resolveMainListingImage({
      bdBaseUrl: normalizedBaseUrl ?? "",
      userPayload: resolverPayload,
      fetchBdJson,
    });

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[directoryiq-image] listing=${listingEval.listing.source_id} source=${mainImage.source} mainImageUrl=${mainImage.url ?? "null"} evidence=${JSON.stringify(
          mainImage.evidence ?? {}
        )} attempts=${mainImage.attempts.join(" | ")}`
      );
    }

    return NextResponse.json({
      listing: {
        listing_id: listingEval.listing.source_id,
        listing_name: listingEval.listing.title ?? listingEval.listing.source_id,
        listing_url: listingEval.listing.url,
        mainImageUrl: mainImage.url,
        mainImageSource: mainImage.source,
        imageResolutionAttempts: mainImage.attempts,
      },
      evaluation: listingEval.evaluation,
      authority_posts: listingEval.authorityPosts.map((post) => ({
        id: post.id,
        slot: post.slot_index,
        type: post.post_type,
        title: post.title,
        focus_topic: post.focus_topic,
        status: post.status,
        blog_to_listing_status: post.blog_to_listing_link_status,
        listing_to_blog_status: post.listing_to_blog_link_status,
        featured_image_url: post.featured_image_url,
        published_url: post.published_url,
        updated_at: post.updated_at,
      })),
      settings: listingEval.settings,
      integrations: {
        brilliant_directories: bdIntegration.status === "connected",
        openai: openAiIntegration.status === "connected" || Boolean(process.env.OPENAI_API_KEY),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listing detail error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
