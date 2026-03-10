export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";

export async function GET(req: NextRequest) {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return NextResponse.json({
      openaiConfigured: false,
      bdConfigured: false,
      integrations: [],
    });
  }

  return proxyDirectoryIqRead(req, "/api/directoryiq/integrations");
}
