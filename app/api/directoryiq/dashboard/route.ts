export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";

const DASHBOARD_PATH = "/api/directoryiq/dashboard";

export async function GET(req: NextRequest) {
  return proxyDirectoryIqRequest(req, DASHBOARD_PATH, "GET");
}

export async function POST(req: NextRequest) {
  return proxyDirectoryIqRequest(req, DASHBOARD_PATH, "POST");
}
