import { NextRequest } from "next/server";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";

export const runtime = "nodejs";

type Params = { params: Promise<{ versionId: string }> | { versionId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const { versionId } = await params;
  return proxyDirectoryIqRequest(
    req,
    `/api/directoryiq/versions/${encodeURIComponent(versionId)}/restore`,
    "POST"
  );
}
