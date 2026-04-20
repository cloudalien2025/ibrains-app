export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { normalizeOpenAiModel } from "@/lib/siteforge/ai";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { maybeSiteForgePersistenceErrorResponse } from "@/lib/siteforge/apiErrors";
import {
  clearProjectAiConfig,
  clearProjectSerpApiConfig,
  saveProjectAiConfig,
  saveProjectSerpApiConfig,
} from "@/lib/siteforge/workspace";
import { normalizeWorkspace } from "@/lib/siteforge/workspaceShape";

function parseModel(value: unknown): string {
  return normalizeOpenAiModel(typeof value === "string" ? value : undefined);
}

function parseBody(raw: unknown): { openAiApiKey: string; serpApiKey: string; model: string } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legacyOpenAiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const openAiApiKey = typeof body.openAiApiKey === "string" ? body.openAiApiKey : legacyOpenAiKey;
  const serpApiKey = typeof body.serpApiKey === "string" ? body.serpApiKey : "";
  return {
    openAiApiKey: openAiApiKey.trim(),
    serpApiKey: serpApiKey.trim(),
    model: parseModel(body.model),
  };
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

  const parsed = parseBody(await req.json().catch(() => null));
  if (!parsed.openAiApiKey && !parsed.serpApiKey) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Provide at least one API key (OpenAI or SerpApi).",
        },
      },
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

    if (parsed.openAiApiKey) {
      await saveProjectAiConfig({
        repo,
        projectId: canonicalProjectId,
        model: parsed.model,
        apiKey: parsed.openAiApiKey,
      });
    }
    if (parsed.serpApiKey) {
      await saveProjectSerpApiConfig({
        repo,
        projectId: canonicalProjectId,
        apiKey: parsed.serpApiKey,
      });
    }

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
          model: parsed.model,
          openAiConfigured: normalized.project.hasSavedAiSecret,
          serpApiConfigured: normalized.project.hasSavedSerpApiSecret,
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

  const parsed = parseBody(await req.json().catch(() => null));

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

    await saveProjectAiConfig({
      repo,
      projectId: canonicalProjectId,
      model: parsed.model,
      apiKey: parsed.openAiApiKey || undefined,
    });
    if (parsed.serpApiKey) {
      await saveProjectSerpApiConfig({
        repo,
        projectId: canonicalProjectId,
        apiKey: parsed.serpApiKey,
      });
    }

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
          model: parsed.model,
          openAiConfigured: normalized.project.hasSavedAiSecret,
          serpApiConfigured: normalized.project.hasSavedSerpApiSecret,
          status: normalized.project.hasSavedAiSecret || normalized.project.hasSavedSerpApiSecret ? "saved" : "not_saved",
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

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const provider =
      body?.provider === "openai" || body?.provider === "serpapi" || body?.provider === "all"
        ? body.provider
        : "all";

    if (provider === "openai" || provider === "all") {
      await clearProjectAiConfig({
        repo,
        projectId: canonicalProjectId,
        model: project.aiModel ?? "gpt-4.1-mini",
      });
    }
    if (provider === "serpapi" || provider === "all") {
      await clearProjectSerpApiConfig({
        repo,
        projectId: canonicalProjectId,
      });
    }

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
          openAiConfigured: normalized.project.hasSavedAiSecret,
          serpApiConfigured: normalized.project.hasSavedSerpApiSecret,
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
