import { NextResponse } from "next/server";

export async function GET() {
  try {
    const payload = {
      service: "ibrains",
      version: process.env.APP_VERSION || "0.1.0",
      timestamp: new Date().toISOString(),
      node: process.version,
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        error: "release endpoint failure",
        message: String(err),
      },
      { status: 500 }
    );
  }
}
