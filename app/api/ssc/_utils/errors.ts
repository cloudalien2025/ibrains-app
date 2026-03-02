import { NextResponse } from "next/server";

export function sscError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}
