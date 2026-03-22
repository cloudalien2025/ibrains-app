import type { NextRequest } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

export async function requireDirectoryIqWriteUser(req: NextRequest): Promise<string> {
  const userId = resolveUserId(req);
  await ensureUser(userId);
  return userId;
}
