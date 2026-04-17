export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";

export async function GET() {
  const { unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const repo = await getSiteForgeRepository();
  const summary = await repo.getAdminSummary();
  return NextResponse.json({ summary }, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
