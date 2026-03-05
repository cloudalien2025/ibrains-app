import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/_meta/release") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/meta/release";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/_meta/release"],
};
