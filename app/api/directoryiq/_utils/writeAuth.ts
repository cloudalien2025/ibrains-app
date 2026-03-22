import type { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

export async function requireDirectoryIqWriteUser(req: NextRequest): Promise<string> {
  const userId = resolveUserId(req);
  // Mock graph e2e mode intentionally runs without real DB wiring.
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return userId;
  }
  await ensureUser(userId);
  return userId;
}
