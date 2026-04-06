export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonError, proxyToBrains, unexpectedErrorResponse } from "../_utils/proxy";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  extractBrainSlug,
  toCreateBrainUpstreamPayload,
  validateCreateBrainPayload,
} from "@/lib/brains/createBrain";

async function shouldFallbackToPublic(response: Response): Promise<boolean> {
  if (response.status !== 500) return false;

  const payload = (await response.clone().json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  const message = payload?.error?.message ?? "";

  return (
    message.includes("Missing BRAINS_MASTER_KEY or BRAINS_X_API_KEY") ||
    message.includes("Missing required env var: BRAINS_MASTER_KEY or BRAINS_X_API_KEY")
  );
}

export async function GET(req: NextRequest) {
  try {
    const primary = await proxyToBrains(req, "/v1/brains", { requireAuth: true });

    if (await shouldFallbackToPublic(primary)) {
      return await proxyToBrains(req, "/v1/brains/public", { requireAuth: false });
    }

    return primary;
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) return unauthorizedResponse;

    const body = await req.clone().json().catch(() => null);
    const validation = validateCreateBrainPayload(body);
    if (!validation.ok) {
      return jsonError("VALIDATION_ERROR", validation.message, 400, {
        field: validation.field,
      });
    }

    const listRes = await proxyToBrains(
      new NextRequest(req.url, {
        method: "GET",
        headers: req.headers,
      }),
      "/v1/brains",
      { requireAuth: true }
    );
    if (listRes.ok) {
      const listPayload = await listRes.json().catch(() => null);
      const list = Array.isArray(listPayload)
        ? listPayload
        : (listPayload as Record<string, unknown> | null)?.brains ??
          (listPayload as Record<string, unknown> | null)?.items ??
          (listPayload as Record<string, unknown> | null)?.data ??
          [];
      if (Array.isArray(list)) {
        const slugExists = list.some((brain) => extractBrainSlug(brain) === validation.data.slug);
        if (slugExists) {
          return jsonError("DUPLICATE_SLUG", "Slug already exists. Choose a unique slug.", 409);
        }
      }
    }

    const upstream = await proxyToBrains(
      new NextRequest(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(toCreateBrainUpstreamPayload(validation.data)),
      }),
      "/v1/brains",
      { requireAuth: true }
    );

    if (!upstream.ok) {
      const payload = await upstream.clone().json().catch(() => null);
      const message =
        (payload as { error?: { message?: string } } | null)?.error?.message ||
        "Brain creation failed.";
      const lowerMessage = message.toLowerCase();
      if (
        upstream.status === 409 ||
        lowerMessage.includes("duplicate") ||
        lowerMessage.includes("already exists") ||
        lowerMessage.includes("unique")
      ) {
        return jsonError("DUPLICATE_SLUG", "Slug already exists. Choose a unique slug.", 409);
      }
      return upstream;
    }

    const created = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    const createdId =
      (typeof created?.brain_id === "string" && created.brain_id) ||
      (typeof created?.id === "string" && created.id) ||
      validation.data.slug;
    const createdSlug =
      (typeof created?.slug === "string" && created.slug) || validation.data.slug;

    return NextResponse.json(
      {
        ...(created ?? {}),
        id: createdId,
        brain_id: createdId,
        slug: createdSlug,
        name: validation.data.name,
      },
      { status: upstream.status }
    );
  } catch {
    return unexpectedErrorResponse();
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
