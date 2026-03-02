export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { addDirectoryIqVersion, getDirectoryIqVersionById } from "@/app/api/directoryiq/_utils/selectionData";
import { makeVersionLabel, verifyApprovalToken } from "@/app/api/directoryiq/_utils/authority";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ versionId: string }> | { versionId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as { approve_restore?: boolean; approval_token?: string };
    if (!body.approve_restore) {
      return NextResponse.json({ error: "Restore requires explicit approval." }, { status: 400 });
    }

    const { versionId } = await Promise.resolve(context.params);
    const tokenResult = verifyApprovalToken(body.approval_token ?? "", {
      userId,
      versionId,
      action: "restore",
    });
    if (!tokenResult.ok) {
      return NextResponse.json({ error: tokenResult.reason }, { status: 400 });
    }
    const version = await getDirectoryIqVersionById(userId, versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    const restoreVersionId = await addDirectoryIqVersion(userId, {
      listingId: version.listing_source_id,
      actionType: "restore",
      versionLabel: makeVersionLabel("RESTORE"),
      scoreSnapshot: version.score_snapshot_json,
      contentDelta: version.content_delta_json,
      linkDelta: version.link_delta_json,
    });

    return NextResponse.json({
      ok: true,
      restored_from_version_id: version.id,
      restore_version_id: restoreVersionId,
      requires_manual_approval: true,
      auto_restore: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown restore error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
