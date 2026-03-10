export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const { listingId } = await Promise.resolve(params);
  const upstreamListingId = encodeURIComponent(decodeURIComponent(listingId));
  return proxyDirectoryIqRead(req, `/api/directoryiq/listings/${upstreamListingId}/support`);
}
