export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { BuildSession } from "@/lib/siteforge/contracts";
import { parseBuildPayload, resolveConnection, sanitizeConnection } from "@/lib/siteforge/api";
import { createInitialRunState } from "@/lib/siteforge/orchestrator";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { enqueueBuildJob } from "@/lib/siteforge/runner";
import { createId, nowIso } from "@/lib/siteforge/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  try {
    const { projectId } = await Promise.resolve(params);
    const payload = parseBuildPayload(await req.json().catch(() => null));
    const repo = await getSiteForgeRepository();

    const project = await repo.getProject(projectId, userId);
    if (!project) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    }

    const connection = resolveConnection(payload);
    const now = nowIso();

    const session: BuildSession = {
      id: createId("sfs"),
      projectId,
      userId,
      prompt: payload.prompt,
      connectionProfile: sanitizeConnection(connection),
      status: "queued",
      runState: createInitialRunState(),
      sitePlan: null,
      contentPackage: null,
      buildSpec: null,
      qaResult: null,
      executionResult: null,
      revisionHistory: [],
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await repo.createSession(session);
    await repo.updateProject(projectId, { latestSessionId: session.id });
    await enqueueBuildJob({ sessionId: session.id, prompt: payload.prompt, connection });

    return NextResponse.json({ session }, { status: 202 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Invalid request body.",
        },
      },
      { status: 400 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
