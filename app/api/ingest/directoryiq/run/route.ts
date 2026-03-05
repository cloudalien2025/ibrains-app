export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { BdIngestError, runDirectoryIqFullIngest } from "@/app/api/directoryiq/_utils/ingest";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const result = await runDirectoryIqFullIngest(userId);

    return NextResponse.json({
      run_id: result.runId,
      status: result.status,
      counts: result.counts,
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
        },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ ingest error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
