export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { previewLeakFix } from "@/app/api/directoryiq/_utils/authorityGraph";

export async function POST(req: NextRequest) {
  try {
    const tenantId = resolveUserId(req);
    await ensureUser(tenantId);

    const body = (await req.json().catch(() => ({}))) as {
      blogNodeId?: string;
      listingNodeId?: string;
    };

    if (!body.blogNodeId || !body.listingNodeId) {
      return NextResponse.json({ error: "blogNodeId and listingNodeId are required" }, { status: 400 });
    }

    const preview = await previewLeakFix({
      tenantId,
      blogNodeId: body.blogNodeId,
      listingNodeId: body.listingNodeId,
    });

    return NextResponse.json({
      diffJson: preview.diffJson,
      renderedPreviewHtml: preview.renderedPreviewHtml,
      beforeHtml: preview.beforeHtml,
      afterHtml: preview.afterHtml,
      linkChecks: preview.linkChecks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview fix" },
      { status: 500 }
    );
  }
}
