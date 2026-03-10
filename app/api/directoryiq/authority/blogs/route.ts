import { NextRequest } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";

export async function GET(req: NextRequest) {
  return proxyDirectoryIqRead(req, "/api/directoryiq/authority/blogs");
}
