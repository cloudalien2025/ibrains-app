export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyToBrains } from "../../../_utils/proxy";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { resolveBrainId } from "@/lib/brains/resolveBrainId";
import { runAdapter } from "@/lib/directoryiq/ingestion/adapters";
import { runMultiSourceIngest } from "@/lib/directoryiq/ingestion/engine";
import { type IngestSourceType } from "@/lib/directoryiq/ingestion/contracts";

function hasValidServiceApiKey(req: NextRequest) {
  const provided = req.headers.get("x-api-key")?.trim();
  if (!provided) return false;

  const candidates = [
    process.env.BRAINS_WORKER_API_KEY,
    process.env.BRAINS_MASTER_KEY,
    process.env.BRAINS_X_API_KEY,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => candidate === provided);
}

function normalizeSourceType(value: unknown): IngestSourceType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "web_search" ||
    normalized === "website_url" ||
    normalized === "document_upload" ||
    normalized === "youtube"
  ) {
    return normalized;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    if (!hasValidServiceApiKey(req)) {
      const { unauthorizedResponse } = await requireSignedInUser();
      if (unauthorizedResponse) return unauthorizedResponse;
    }

    const { id } = await Promise.resolve(params);
    const resolvedId = resolveBrainId(id);
    const bodyRequest = req.clone();

    const contentType = req.headers.get("content-type") ?? "";
    let payload: Record<string, unknown> = {};
    let formData: FormData | undefined;

    if (contentType.includes("multipart/form-data")) {
      formData = await bodyRequest.formData();
      payload = Object.fromEntries(
        [...formData.entries()].filter(([, value]) => typeof value === "string") as Array<
          [string, string]
        >
      );
    } else {
      payload = ((await bodyRequest.json().catch(() => ({}))) || {}) as Record<string, unknown>;
    }

    const sourceType =
      normalizeSourceType(payload.source_type ?? payload.sourceType) ??
      (formData ? normalizeSourceType(formData.get("source_type")) : null);

    if (!sourceType) {
      // Preserve legacy upstream flow for existing keyword-only payloads.
      return proxyToBrains(req, `/v1/brains/${resolvedId}/ingest`, { requireAuth: true });
    }

    const items = await runAdapter({
      sourceType,
      payload,
      formData,
    });

    const summary = await runMultiSourceIngest({
      brainId: resolvedId,
      sourceType,
      items,
    });

    return NextResponse.json(
      {
        ok: true,
        source_type: sourceType,
        summary,
        counters: {
          candidates_found: summary.candidates_found,
          new_items_added: summary.new_items_added,
          duplicates_skipped: summary.duplicates_skipped,
          updated_items: summary.updated_items,
          versioned_items: summary.versioned_items,
          eligible_for_processing: summary.eligible_for_processing,
          failed_items: summary.failed_items,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "DIRECTORYIQ_INGEST_FAILED",
          message:
            "Multi-source ingest failed. Check DATABASE_URL/runtime dependencies and request payload.",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
