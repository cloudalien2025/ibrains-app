export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { discardDraft, getDraftById, submitDraft, validateDraft } from "@/lib/ecomviper/walmart/walmart-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { id } = await Promise.resolve(params);
    const draft = getDraftById(id);
    if (!draft) return fail(404, "Draft not found.", "NOT_FOUND");

    return ok({ ok: true, draft });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to load draft.");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { id } = await Promise.resolve(params);
    const body = (await req.json().catch(() => ({}))) as { action?: "validate" | "submit" };

    const action = body.action ?? "validate";
    if (action === "submit") {
      const revalidatedDraft = validateDraft(id);
      const hasViolations = !revalidatedDraft.validationResult.valid || (revalidatedDraft.validationResult.violations?.length ?? 0) > 0;

      if (hasViolations) {
        const blockedDraft = submitDraft(id);
        return ok({
          ok: false,
          action,
          blocked: true,
          draft: blockedDraft,
          violations: blockedDraft.validationResult.violations ?? [],
          warnings: blockedDraft.validationResult.warnings,
          suggestions: blockedDraft.validationResult.suggestions ?? [],
        });
      }

      const draft = submitDraft(id);
      return ok({ ok: true, action, draft });
    }

    const draft = validateDraft(id);

    return ok({ ok: true, action, draft });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to update draft.");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { id } = await Promise.resolve(params);
    const draft = discardDraft(id);
    return ok({ ok: true, draft });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to discard draft.");
  }
}
