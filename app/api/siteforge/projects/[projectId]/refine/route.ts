export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { maybeSiteForgePersistenceErrorResponse } from "@/lib/siteforge/apiErrors";
import { enqueueRevisionJob } from "@/lib/siteforge/runner";
import { resolveConnection } from "@/lib/siteforge/api";
import { resolveRuntimeConnection } from "@/lib/siteforge/workspace";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const { projectId } = await Promise.resolve(params);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Refinement message is required." } }, { status: 400 });
  }

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "sessionId is required." } }, { status: 400 });
  }

  try {
    const repo = await getSiteForgeRepository();
    const project = await repo.getProject(projectId, userId);
    if (!project) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    }

    const session = await repo.getSession(sessionId);
    if (!session || session.projectId !== projectId || session.userId !== userId) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found." } }, { status: 404 });
    }

  const connectionFromBody = resolveConnection({
    connection:
      body?.connection && typeof body.connection === "object" && !Array.isArray(body.connection)
        ? (body.connection as {
            label?: string;
            baseUrl?: string;
            username?: string;
            appPassword?: string;
            hasThriveHint?: boolean;
          })
      : undefined,
  });

    const resolved = await resolveRuntimeConnection({
      repo,
      projectId,
      incoming: connectionFromBody,
      preferConnectionId:
        typeof body?.connectionId === "string" ? body.connectionId : (session.connectionId ?? undefined),
    });

    await enqueueRevisionJob({
      sessionId,
      message,
      connection: resolved.connection,
      connectionId: resolved.connectionId,
      homepageStrategy: project.homepageStrategy,
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to enqueue SiteForge refinement." } },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
