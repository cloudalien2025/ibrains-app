import { NextResponse } from "next/server";

export function GET() {
  const sha = process.env.NEXT_PUBLIC_RELEASE_SHA ?? process.env.RELEASE_SHA ?? "unknown";
  const builtAt = process.env.NEXT_PUBLIC_BUILT_AT ?? process.env.BUILT_AT ?? "unknown";

  return NextResponse.json({
    sha,
    built_at: builtAt,
  });
}
