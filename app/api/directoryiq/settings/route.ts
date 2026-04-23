import { NextRequest } from "next/server";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyDirectoryIqRequest(req, "/api/directoryiq/settings", "GET");
}

export async function POST(req: NextRequest) {
  return proxyDirectoryIqRequest(req, "/api/directoryiq/settings", "POST");
}
