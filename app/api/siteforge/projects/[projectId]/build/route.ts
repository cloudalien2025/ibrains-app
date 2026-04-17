export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { BuildSession } from "@/lib/siteforge/contracts";
import { resolvePlatformOpenAiKey } from "@/lib/siteforge/ai";
import { parseBuildPayload, resolveConnection, sanitizeConnection } from "@/lib/siteforge/api";
import { createInitialRunState } from "@/lib/siteforge/orchestrator";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { enqueueBuildJob } from "@/lib/siteforge/runner";
import { createId, nowIso } from "@/lib/siteforge/utils";
import { resolveProjectAiApiKey, resolveRuntimeConnection } from "@/lib/siteforge/workspace";

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

    const initialConnection = resolveConnection(payload);
    const resolvedConnection = await resolveRuntimeConnection({
      repo,
      projectId,
      incoming: initialConnection,
      preferConnectionId: payload.connectionId,
    });
    const connection = resolvedConnection.connection;
    const userApiKey = await resolveProjectAiApiKey({ repo, projectId });
    const platformApiKey = resolvePlatformOpenAiKey();
    const resolvedApiKey = userApiKey || platformApiKey;
    const generationSource = userApiKey ? "user_key" : platformApiKey ? "platform_key" : "deterministic_fallback";
    const model = project.aiModel ?? "gpt-4.1-mini";

    if (!resolvedApiKey) {
      return NextResponse.json(
        {
          error: {
            code: "AI_KEY_REQUIRED",
            message:
              "Generation is blocked: no usable OpenAI API key is configured. Save a project AI key or configure SITEFORGE_OPENAI_API_KEY.",
          },
        },
        { status: 400 }
      );
    }

    const now = nowIso();

    const session: BuildSession = {
      id: createId("sfs"),
      projectId,
      userId,
      connectionId: resolvedConnection.connectionId,
      type: "generate",
      triggerSource: "user",
      prompt: payload.prompt,
      websiteBrief: payload.websiteBrief,
      generationSource,
      aiModel: model,
      connectionProfile: sanitizeConnection(connection),
      status: "queued",
      runState: createInitialRunState(),
      sitePlan: null,
      contentPackage: null,
      buildSpec: null,
      qaResult: null,
      executionResult: null,
      revisionHistory: [],
      errorSummary: null,
      startedAt: now,
      completedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await repo.createSession(session);
    await repo.updateProject(projectId, {
      latestSessionId: session.id,
      primaryPrompt: payload.prompt,
      websiteBrief: payload.websiteBrief,
      currentState: "running_build",
      homepageStrategy: payload.homepageStrategy,
    });
    await repo.markProjectOpened(userId, projectId);
    await enqueueBuildJob({
      sessionId: session.id,
      prompt: payload.prompt,
      websiteBrief: payload.websiteBrief,
      apiKey: resolvedApiKey,
      aiModel: model,
      generationSource,
      connection,
      connectionId: session.connectionId,
      homepageStrategy: payload.homepageStrategy ?? project.homepageStrategy,
    });

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
