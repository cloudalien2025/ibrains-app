import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { runDirectoryIqBlogIngest } from "@/app/api/directoryiq/_utils/ingest";
import { rebuildGraph } from "@/src/directoryiq/graph/graphService";

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const ingest = await runDirectoryIqBlogIngest(userId);
    if (ingest.status === "failed") {
      return NextResponse.json(
        {
          ok: false,
          ingest,
          error: {
            message: ingest.errorMessage ?? "Blog ingest failed",
            code: "INGEST_FAILED",
            reqId,
          },
        },
        { status: 500 }
      );
    }

    const graph = await rebuildGraph({ tenantId: "default", mode: "scan" });
    console.info(
      `[directoryiq-authority-ingest-route] req=${reqId} blogs_fetched=${ingest.counts.blogPosts} edges_upserted=${graph.stats.edgesUpserted} mentions_edges_upserted=${graph.stats.issuesCounts.mentions_without_links}`
    );

    return NextResponse.json({
      ok: true,
      reqId,
      ingest,
      graph,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run authority blog ingest";
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
