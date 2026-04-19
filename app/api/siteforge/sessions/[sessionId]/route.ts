export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { maybeSiteForgePersistenceErrorResponse } from "@/lib/siteforge/apiErrors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const { sessionId } = await Promise.resolve(params);
  try {
    const repo = await getSiteForgeRepository();
    const session = await repo.getSession(sessionId);

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found." } }, { status: 404 });
    }

    const failures = await repo.getFailures(sessionId);
    return NextResponse.json({ session, failures }, { status: 200 });
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load SiteForge session." } },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
