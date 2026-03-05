import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: "If Ferrari theme is applied, pages should show gradients/glow; this endpoint just confirms build shipped.",
    timestamp: new Date().toISOString(),
  });
}
