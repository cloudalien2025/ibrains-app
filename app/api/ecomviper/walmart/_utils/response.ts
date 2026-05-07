import crypto from "crypto";
import { NextResponse } from "next/server";

export function ok<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function fail(status: number, message: string, code = "INTERNAL_ERROR") {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        reqId: crypto.randomUUID(),
      },
    },
    { status }
  );
}
