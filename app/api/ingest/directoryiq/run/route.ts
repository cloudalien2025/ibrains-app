export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { BdIngestError, runDirectoryIqFullIngest } from "@/app/api/directoryiq/_utils/ingest";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { shouldServeDirectoryIqLocally } from "@/app/api/directoryiq/_utils/runtimeParity";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { isAdminRequest } from "@/app/api/directoryiq/_utils/bdSites";

export async function POST(req: NextRequest) {
  if (!shouldServeDirectoryIqLocally(req)) {
    return proxyDirectoryIqRequest(req, "/api/ingest/directoryiq/run", "POST");
  }

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const searchParams = req.nextUrl.searchParams;
    const body = (await req.json().catch(() => ({}))) as {
      site_id?: string;
      site?: string;
    };
    const siteId = (searchParams.get("site_id") ?? body.site_id ?? "").trim() || null;
    const siteMode = (searchParams.get("site") ?? body.site ?? "").trim().toLowerCase();
    const allSites = siteMode === "all";
    if (allSites && !isAdminRequest(req)) {
      return NextResponse.json({ error: "admin_only" }, { status: 403 });
    }

    const result = await runDirectoryIqFullIngest(userId, { siteId, allSites });

    return NextResponse.json({
      run_id: result.runId,
      status: result.status,
      counts: result.counts,
      site_results: result.siteResults ?? null,
      error_message: result.errorMessage ?? null,
    });
  } catch (error) {
    if (error instanceof BdIngestError) {
      return NextResponse.json(
        {
          error: error.code,
          baseUrl_present: error.baseUrlPresent,
          apiKey_present: error.apiKeyPresent,
          listingsPath_present: error.listingsPathPresent,
          listingsDataId_present: error.listingsDataIdPresent,
          listingsDataId_value: error.listingsDataIdValue,
          data_type_observed: error.dataTypeObserved,
          status_code: error.statusCode,
          endpoint: error.endpoint,
          page: error.page,
          message_snippet: error.messageSnippet,
          pages_succeeded: error.pagesSucceeded,
          page_failed: error.pageFailed,
          total_listings_ingested_so_far: error.listingsIngested,
          will_resume_from_page: error.willResumeFromPage,
          retry_attempts: error.retryAttempts,
          next_retry_delay_ms: error.nextRetryDelayMs,
        },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ ingest error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
