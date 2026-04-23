import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityBlogs } from "@/src/directoryiq/graph/graphService";
import { shouldServeDirectoryIqLocally } from "@/app/api/directoryiq/_utils/runtimeParity";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (shouldServeDirectoryIqLocally(req)) {
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
          error: {
            message,
            code: "INTERNAL_ERROR",
            reqId,
          },
        },
        { status: 500 }
      );
    }
  }

  return proxyDirectoryIqRead(req, "/api/directoryiq/authority/blogs");
}
