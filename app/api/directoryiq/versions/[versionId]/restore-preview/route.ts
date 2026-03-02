export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqVersionById } from "@/app/api/directoryiq/_utils/selectionData";
import { issueApprovalToken } from "@/app/api/directoryiq/_utils/authority";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ versionId: string }> | { versionId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { versionId } = await Promise.resolve(context.params);
    const version = await getDirectoryIqVersionById(userId, versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    return NextResponse.json({
      preview: {
        version_id: version.id,
        listing_id: version.listing_source_id,
        action_type: version.action_type,
        score_snapshot: version.score_snapshot_json,
        content_delta: version.content_delta_json,
        link_delta: version.link_delta_json,
      },
      approval_token: issueApprovalToken({
        userId,
        versionId,
        action: "restore",
      }),
      requires_manual_approval: true,
      auto_restore: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown restore preview error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
