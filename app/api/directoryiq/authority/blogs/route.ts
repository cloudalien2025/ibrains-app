import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityBlogs } from "@/src/directoryiq/graph/graphService";

export async function GET(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const blogs = await getAuthorityBlogs({ tenantId: "default" });
    return NextResponse.json({ ok: true, blogs, reqId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load authority blogs";
    return NextResponse.json(
      {
        ok: false,
        blogs: [],
        error: {
          message,
          code: "INTERNAL_ERROR",
          reqId,
        },
      },
      { status: 200 }
    );
  }
}
