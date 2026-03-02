export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqVersions } from "@/app/api/directoryiq/_utils/selectionData";

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const versions = await getDirectoryIqVersions(userId);
    return NextResponse.json({ versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown versions error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
