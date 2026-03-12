export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqIntegrationSecret } from "@/app/api/directoryiq/_utils/credentials";
import { listBdSites } from "@/app/api/directoryiq/_utils/bdSites";
import { hasCanonicalDirectoryIqConnection } from "@/app/api/directoryiq/_utils/connectedState";

export async function GET(req: NextRequest) {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return NextResponse.json({
      openaiConfigured: false,
      bdConfigured: false,
      integrations: [],
    });
  }

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const [openai, sites] = await Promise.all([
      getDirectoryIqIntegrationSecret(userId, "openai"),
      listBdSites(userId),
    ]);

    const openaiConfigured = Boolean(openai?.secret?.trim());
    const bdConfigured = hasCanonicalDirectoryIqConnection(sites);

    return NextResponse.json({
      openaiConfigured,
      bdConfigured,
      integrations: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve DirectoryIQ integrations";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
