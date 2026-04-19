export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { normalizeOpenAiModel } from "@/lib/siteforge/ai";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { maybeSiteForgePersistenceErrorResponse } from "@/lib/siteforge/apiErrors";
import { clearProjectAiConfig, saveProjectAiConfig } from "@/lib/siteforge/workspace";
import { normalizeWorkspace } from "@/lib/siteforge/workspaceShape";

function parseModel(value: unknown): string {
  return normalizeOpenAiModel(typeof value === "string" ? value : undefined);
}

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
  if (!projectId || !projectId.trim()) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Project id is required." } },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "OpenAI API key is required." } },
      { status: 400 }
    );
  }

  try {
    const repo = await getSiteForgeRepository();
    const canonicalProjectId = projectId.trim();
    const project = await repo.getProject(canonicalProjectId, userId);
    if (!project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found for current user." } },
        { status: 404 }
      );
    }

    const model = parseModel(body?.model);
    await saveProjectAiConfig({
      repo,
      projectId: canonicalProjectId,
      model,
      apiKey,
    });

    const workspace = await repo.getWorkspace(canonicalProjectId, userId);
    const normalized = normalizeWorkspace(workspace);
    if (!normalized) {
      return NextResponse.json(
        { error: { code: "WORKSPACE_INVALID", message: "Project workspace could not be loaded." } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        workspace: normalized,
        ai: {
          provider: "openai",
          model,
          status: "saved",
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save SiteForge AI configuration." } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const { projectId } = await Promise.resolve(params);
  if (!projectId || !projectId.trim()) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Project id is required." } },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const model = parseModel(body?.model);

  try {
    const repo = await getSiteForgeRepository();
    const canonicalProjectId = projectId.trim();
    const project = await repo.getProject(canonicalProjectId, userId);
    if (!project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found for current user." } },
        { status: 404 }
      );
    }

    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    await saveProjectAiConfig({
      repo,
      projectId: canonicalProjectId,
      model,
      apiKey: apiKey || undefined,
    });

    const workspace = await repo.getWorkspace(canonicalProjectId, userId);
    const normalized = normalizeWorkspace(workspace);
    if (!normalized) {
      return NextResponse.json(
        { error: { code: "WORKSPACE_INVALID", message: "Project workspace could not be loaded." } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        workspace: normalized,
        ai: {
          provider: "openai",
          model,
          status: normalized.project.hasSavedAiSecret ? "saved" : "not_saved",
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update SiteForge AI configuration." } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const { projectId } = await Promise.resolve(params);
  if (!projectId || !projectId.trim()) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Project id is required." } },
      { status: 400 }
    );
  }

  try {
    const repo = await getSiteForgeRepository();
    const canonicalProjectId = projectId.trim();
    const project = await repo.getProject(canonicalProjectId, userId);
    if (!project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found for current user." } },
        { status: 404 }
      );
    }

    await clearProjectAiConfig({
      repo,
      projectId: canonicalProjectId,
      model: project.aiModel ?? "gpt-4.1-mini",
    });

    const workspace = await repo.getWorkspace(canonicalProjectId, userId);
    const normalized = normalizeWorkspace(workspace);
    if (!normalized) {
      return NextResponse.json(
        { error: { code: "WORKSPACE_INVALID", message: "Project workspace could not be loaded." } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        workspace: normalized,
        ai: {
          provider: "openai",
          model: normalized.project.aiModel ?? "gpt-4.1-mini",
          status: "not_saved",
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove SiteForge AI configuration." } },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
