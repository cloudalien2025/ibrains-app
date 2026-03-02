export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as generateDraftPost } from "@/app/api/directoryiq/listings/[listingId]/authority/[slot]/draft/route";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ listingId: string; slot: string }> | { listingId: string; slot: string } }
) {
  return generateDraftPost(req, context);
}
