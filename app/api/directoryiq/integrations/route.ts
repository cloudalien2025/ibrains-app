export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { listDirectoryIqIntegrations } from "@/app/api/directoryiq/_utils/credentials";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const integrations = await listDirectoryIqIntegrations(userId);
    return NextResponse.json({ integrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integrations fetch error";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR", reqId: crypto.randomUUID() } }, { status: 500 });
  }
}
