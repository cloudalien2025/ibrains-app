export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { homepageStrategyModes, HomepageStrategyMode } from "@/lib/siteforge/contracts";
import type { SiteForgeProject } from "@/lib/siteforge/contracts";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { nowIso, toSlug } from "@/lib/siteforge/utils";
import { normalizeWorkspace } from "@/lib/siteforge/workspaceShape";

export async function GET(
  _req: NextRequest,
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
  const canonicalProjectId = projectId.trim();
  const repo = await getSiteForgeRepository();
  const workspace = await repo.getWorkspace(canonicalProjectId, userId);
  if (!workspace) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found for current user." } },
      { status: 404 }
    );
  }

  const normalized = normalizeWorkspace(workspace);
  if (!normalized) {
    return NextResponse.json({ error: { code: "WORKSPACE_INVALID", message: "Project workspace could not be loaded." } }, { status: 500 });
  }

  return NextResponse.json(normalized, { status: 200 });
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
  const canonicalProjectId = projectId.trim();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const repo = await getSiteForgeRepository();
  const project = await repo.getProject(canonicalProjectId, userId);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found for current user." } },
      { status: 404 }
    );
  }

  const markOpened = body?.markOpened === true;
  const homepageStrategyRaw = typeof body?.homepageStrategy === "string" ? body.homepageStrategy : null;
  const homepageStrategy =
    homepageStrategyRaw && (homepageStrategyModes as readonly string[]).includes(homepageStrategyRaw)
      ? (homepageStrategyRaw as HomepageStrategyMode)
      : null;

  if (markOpened) {
    await repo.markProjectOpened(userId, canonicalProjectId);
  }
  if (homepageStrategy) {
    await repo.setProjectHomepageStrategy(canonicalProjectId, homepageStrategy);
  }

  const updatePatch: Partial<SiteForgeProject> = {
    updatedAt: nowIso(),
  };
  if (typeof body?.name === "string") {
    const trimmedName = body.name.trim();
    if (trimmedName) {
      updatePatch.name = trimmedName;
      updatePatch.slug = toSlug(trimmedName);
    }
  }
  if (typeof body?.currentState === "string" && body.currentState) {
    updatePatch.currentState = body.currentState;
  }
  if (typeof body?.primaryPrompt === "string") {
    updatePatch.primaryPrompt = body.primaryPrompt;
  }
  if (typeof body?.description === "string") {
    updatePatch.description = body.description;
  }

  await repo.updateProject(canonicalProjectId, updatePatch);

  const workspace = await repo.getWorkspace(canonicalProjectId, userId);
  const normalized = normalizeWorkspace(workspace);
  if (!normalized) {
    return NextResponse.json({ error: { code: "WORKSPACE_INVALID", message: "Project workspace could not be loaded." } }, { status: 500 });
  }
  return NextResponse.json(normalized, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
