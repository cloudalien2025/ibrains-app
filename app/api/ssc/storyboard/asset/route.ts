export const runtime = "nodejs";

import { getStorage } from "../../_utils/runtime";
import { sscError } from "../../_utils/errors";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return sscError("SSC_BAD_REQUEST", "key required", 400);
    }
    const storage = getStorage();
    const bytes = await storage.getBytes(key);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return sscError("SSC_ASSET_FAILED", message, 500);
  }
}
