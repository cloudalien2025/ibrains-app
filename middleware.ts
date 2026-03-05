import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/api/_meta/release") {
    url.pathname = "/api/meta/release";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
