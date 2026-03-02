export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  addDirectoryIqVersion,
  getListingEvaluation,
  getListingUpgradeDraft,
  markListingUpgradePushed,
} from "@/app/api/directoryiq/_utils/selectionData";
import {
  getDirectoryIqBdConnection,
  pushUserUpdateToBd,
} from "@/app/api/directoryiq/_utils/integrations";
import { errorPayload, logUpgradeError, logUpgradeInfo, upgradeReqId } from "@/app/api/directoryiq/_utils/listingUpgrade";
import { makeVersionLabel, verifyApprovalToken } from "@/app/api/directoryiq/_utils/authority";
import { bdRequestGet } from "@/app/api/directoryiq/_utils/bdApi";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unwrapMessage(payload: Record<string, unknown> | null): Record<string, unknown> {
  if (!payload) return {};
  if (payload.message && typeof payload.message === "object" && !Array.isArray(payload.message)) {
    return payload.message as Record<string, unknown>;
  }
  if (Array.isArray(payload.message)) {
    const row = payload.message.find((item) => item && typeof item === "object");
    if (row && typeof row === "object") return row as Record<string, unknown>;
  }
  return payload;
}

function resolveDescriptionField(listingRaw: Record<string, unknown>, userPayload: Record<string, unknown>): string {
  const user = unwrapMessage(userPayload);
  const ordered = ["group_desc", "description", "short_description", "post_body", "about_me", "bio"];
  for (const field of ordered) {
    const inListing = asString(listingRaw[field]);
    const inUser = asString(user[field]);
    if (inListing || inUser) return field;
  }
  return "group_desc";
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

    logUpgradeInfo({ reqId, listingId: resolvedListingId, action: "push", message: "request received" });

    const body = (await req.json().catch(() => ({}))) as {
      draftId?: string;
      approved?: boolean;
      approvalToken?: string;
    };
    const draftId = (body.draftId ?? "").trim();
    if (!draftId) {
      const err = errorPayload({ status: 400, reqId, code: "BAD_REQUEST", message: "draftId is required." });
      return NextResponse.json(err.body, { status: err.status });
    }
    if (body.approved !== true) {
      const err = errorPayload({
        status: 400,
        reqId,
        code: "BAD_REQUEST",
        message: "Push requires explicit approved=true.",
      });
      return NextResponse.json(err.body, { status: err.status });
    }

    const tokenCheck = verifyApprovalToken(body.approvalToken ?? "", {
      userId,
      listingId: resolvedListingId,
      action: "listing_push",
    });
    if (!tokenCheck.ok) {
      const err = errorPayload({ status: 400, reqId, code: "TOKEN_INVALID", message: tokenCheck.reason });
      return NextResponse.json(err.body, { status: err.status });
    }

    const detail = await getListingEvaluation(userId, resolvedListingId);
    if (!detail.listing || !detail.evaluation) {
      const err = errorPayload({ status: 404, reqId, code: "NOT_FOUND", message: "Listing not found." });
      return NextResponse.json(err.body, { status: err.status });
    }

    const draft = await getListingUpgradeDraft(userId, resolvedListingId, draftId);
    if (!draft) {
      const err = errorPayload({ status: 404, reqId, code: "NOT_FOUND", message: "Upgrade draft not found." });
      return NextResponse.json(err.body, { status: err.status });
    }
    if (draft.status === "draft") {
      const err = errorPayload({
        status: 400,
        reqId,
        code: "PREVIEW_REQUIRED",
        message: "Preview changes before pushing to Brilliant Directories.",
      });
      return NextResponse.json(err.body, { status: err.status });
    }

    let bdUpdateRef: string | null = null;
    let bdStatus: string | null = null;
    let bdResponseExcerpt: string | null = null;
    if (process.env.E2E_MOCK_BD !== "1") {
      const bd = await getDirectoryIqBdConnection(userId);
      if (!bd) {
        const err = errorPayload({
          status: 400,
          reqId,
          code: "BD_NOT_CONFIGURED",
          message: "Brilliant Directories API not configured. Go to DirectoryIQ -> Settings -> Integrations.",
        });
        return NextResponse.json(err.body, { status: err.status });
      }

      const listingRaw = detail.listing.raw_json ?? {};
      const bdUserId =
        asString(listingRaw.user_id) ||
        asString(listingRaw.id) ||
        asString(listingRaw.group_id) ||
        asString(listingRaw.post_id);
      if (!bdUserId) {
        const err = errorPayload({
          status: 422,
          reqId,
          code: "BD_NOT_CONFIGURED",
          message: "Unable to resolve BD user_id mapping for push.",
        });
        return NextResponse.json(err.body, { status: err.status });
      }

      const userGet = await bdRequestGet({
        baseUrl: bd.baseUrl,
        apiKey: bd.apiKey,
        path: `/api/v2/user/get/${encodeURIComponent(bdUserId)}`,
      });
      const descriptionField = resolveDescriptionField(
        listingRaw as Record<string, unknown>,
        (userGet.json ?? {}) as Record<string, unknown>
      );

      const push = await pushUserUpdateToBd({
        baseUrl: bd.baseUrl,
        apiKey: bd.apiKey,
        userId: bdUserId,
        descriptionField,
        description: draft.proposed_description,
      });

      if (!push.ok) {
        const err = errorPayload({
          status: 502,
          reqId,
          code: "INTERNAL_ERROR",
          message: "Brilliant Directories push failed.",
          details: JSON.stringify(push.body ?? {}),
        });
        return NextResponse.json(err.body, { status: err.status });
      }

      bdUpdateRef = bdUserId;
      bdStatus = "ok";
      bdResponseExcerpt = JSON.stringify(push.body ?? {}).slice(0, 500);
    } else {
      bdUpdateRef = "mock-bd-update-ref";
      bdStatus = "mock";
      bdResponseExcerpt = "{\"ok\":true,\"mock\":true}";
    }

    await markListingUpgradePushed({
      userId,
      listingId: resolvedListingId,
      draftId,
      bdUpdateRef,
      bdStatus,
      bdResponseExcerpt,
    });

    const versionId = await addDirectoryIqVersion(userId, {
      listingId: resolvedListingId,
      actionType: "listing_push",
      versionLabel: makeVersionLabel("LISTING-UPGRADE"),
      scoreSnapshot: {
        before: detail.evaluation.totalScore,
        after: Math.min(100, detail.evaluation.totalScore + 6),
      },
      contentDelta: {
        draft_id: draft.id,
        original_description: draft.original_description,
        proposed_description: draft.proposed_description,
      },
      linkDelta: {},
    });

    logUpgradeInfo({ reqId, listingId: resolvedListingId, action: "push", message: "push completed" });

    return NextResponse.json({
      ok: true,
      reqId,
      versionId,
      bdResultSummary: {
        reference: bdUpdateRef,
        status: bdStatus,
      },
      bdResult: {
        reference: bdUpdateRef,
        status: bdStatus,
      },
    });
  } catch (error) {
    logUpgradeError({ reqId, listingId: resolvedListingId, action: "push", error });
    const message = error instanceof Error ? error.message : "Unknown upgrade push error";
    const err = errorPayload({ status: 500, reqId, code: "INTERNAL_ERROR", message });
    return NextResponse.json(err.body, { status: err.status });
  }
}
