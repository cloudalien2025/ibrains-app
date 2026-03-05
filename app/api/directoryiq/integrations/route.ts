export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getIntegrationStatus } from "@/src/directoryiq/services/integrationsService";
import { listDirectoryIqIntegrations } from "@/app/api/directoryiq/_utils/credentials";

export async function GET(req: NextRequest) {
  try {
    if (process.env.E2E_MOCK_GRAPH === "1") {
      return NextResponse.json({
        openaiConfigured: false,
        bdConfigured: false,
        integrations: [],
      });
    }

    const userId = resolveUserId(req);
    await ensureUser(userId);

    const [status, integrations] = await Promise.all([
      getIntegrationStatus(userId),
      listDirectoryIqIntegrations(userId),
    ]);
    return NextResponse.json({
      ...status,
      integrations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integrations fetch error";
    return NextResponse.json(
      {
        error: {
          message,
          code: "INTERNAL_ERROR",
          reqId: crypto.randomUUID(),
        },
      },
      { status: 500 }
    );
  }
}
