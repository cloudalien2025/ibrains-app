export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { getWalmartFeedStatus, listWalmartFeedSubmissions } from "@/lib/ecomviper/walmart/walmart-feeds";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const feedId = req.nextUrl.searchParams.get("feedId");
    if (feedId) {
      const submission = getWalmartFeedStatus(feedId);
      return ok({ ok: true, submission });
    }

    return ok({ ok: true, submissions: listWalmartFeedSubmissions() });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Failed to read feed status.");
  }
}
