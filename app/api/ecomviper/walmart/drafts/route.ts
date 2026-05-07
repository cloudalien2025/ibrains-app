export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { listDrafts, upsertDraftForSku } from "@/lib/ecomviper/walmart/walmart-store";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    return ok({ ok: true, drafts: listDrafts() });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to list drafts.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as {
      sku?: string;
      draftPayload?: Record<string, unknown>;
    };

    if (!body.sku || typeof body.sku !== "string") {
      return fail(400, "sku is required.", "BAD_REQUEST");
    }

    if (!body.draftPayload || typeof body.draftPayload !== "object") {
      return fail(400, "draftPayload is required.", "BAD_REQUEST");
    }

    const draft = upsertDraftForSku({ sku: body.sku, draftPayload: body.draftPayload, createdBy: userId });
    return ok({ ok: true, draft }, 201);
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to save draft.");
  }
}
