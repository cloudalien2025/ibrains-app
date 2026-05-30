export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  getSupplierMembershipTierSelectionForUser,
  saveSupplierMembershipTierSelectionForUser,
} from "@/lib/ecomviper/settings/supplier-membership";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected supplier membership settings error.";
}

export async function GET() {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) return unauthorizedResponse;
    if (!userId) return fail(401, "Please sign in before loading settings.", "UNAUTHORIZED");

    const membershipTier = await getSupplierMembershipTierSelectionForUser(userId);
    return ok({
      ok: true,
      membershipTier,
    });
  } catch (error) {
    return fail(500, asErrorMessage(error));
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, unauthorizedResponse } = await requireSignedInUser();
    if (unauthorizedResponse) return unauthorizedResponse;
    if (!userId) return fail(401, "Please sign in before saving settings.", "UNAUTHORIZED");

    const body = (await req.json().catch(() => ({}))) as { membershipTier?: unknown };
    const membershipTierRaw = asString(body.membershipTier);
    const membershipTier = membershipTierRaw ? membershipTierRaw : null;
    const savedTier = await saveSupplierMembershipTierSelectionForUser({
      userId,
      membershipTier,
    });

    return ok({
      ok: true,
      membershipTier: savedTier,
    });
  } catch (error) {
    return fail(500, asErrorMessage(error));
  }
}
