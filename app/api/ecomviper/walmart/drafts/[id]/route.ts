export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  discardWalmartDraftForUser,
  getWalmartDraftByIdForUser,
  submitWalmartDraftForUser,
  validateWalmartDraftForUser,
} from "@/lib/ecomviper/walmart/walmart-drafts";

function isDraftNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("draft not found");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before accessing Walmart drafts.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before accessing Walmart drafts.", "UNAUTHORIZED");
    }

    const { id } = await Promise.resolve(params);
    const draft = await getWalmartDraftByIdForUser(userId, id);
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
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before updating Walmart drafts.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before updating Walmart drafts.", "UNAUTHORIZED");
    }

    const { id } = await Promise.resolve(params);
    const body = (await req.json().catch(() => ({}))) as { action?: "validate" | "submit" };

    const action = body.action ?? "validate";
    if (action === "submit") {
      const revalidatedDraft = await validateWalmartDraftForUser(userId, id);
      const hasViolations = !revalidatedDraft.validationResult.valid || (revalidatedDraft.validationResult.violations?.length ?? 0) > 0;

      if (hasViolations) {
        const blockedDraft = await submitWalmartDraftForUser(userId, id);
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

      const draft = await submitWalmartDraftForUser(userId, id);
      return ok({ ok: true, action, draft });
    }

    const draft = await validateWalmartDraftForUser(userId, id);

    return ok({ ok: true, action, draft });
  } catch (error) {
    if (isDraftNotFoundError(error)) {
      return fail(404, "Draft not found.", "NOT_FOUND");
    }
    return fail(500, error instanceof Error ? error.message : "Failed to update draft.");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) {
      if (unauthorizedResponse.status !== 401) return unauthorizedResponse;
      return fail(401, "Please sign in before discarding Walmart drafts.", "UNAUTHORIZED");
    }
    if (!userId) {
      return fail(401, "Please sign in before discarding Walmart drafts.", "UNAUTHORIZED");
    }

    const { id } = await Promise.resolve(params);
    const draft = await discardWalmartDraftForUser(userId, id);
    return ok({ ok: true, draft });
  } catch (error) {
    if (isDraftNotFoundError(error)) {
      return fail(404, "Draft not found.", "NOT_FOUND");
    }
    return fail(500, error instanceof Error ? error.message : "Failed to discard draft.");
  }
}
