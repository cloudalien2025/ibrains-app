export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { homepageStrategyModes, HomepageStrategyMode } from "@/lib/siteforge/contracts";
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
  const repo = await getSiteForgeRepository();
  const workspace = await repo.getWorkspace(projectId, userId);
  if (!workspace) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
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
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const repo = await getSiteForgeRepository();
  const project = await repo.getProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
  }

  const markOpened = body?.markOpened === true;
  const homepageStrategyRaw = typeof body?.homepageStrategy === "string" ? body.homepageStrategy : null;
  const homepageStrategy =
    homepageStrategyRaw && (homepageStrategyModes as readonly string[]).includes(homepageStrategyRaw)
      ? (homepageStrategyRaw as HomepageStrategyMode)
      : null;

  if (markOpened) {
    await repo.markProjectOpened(userId, projectId);
  }
  if (homepageStrategy) {
    await repo.setProjectHomepageStrategy(projectId, homepageStrategy);
  }

  await repo.updateProject(projectId, {
    name: body?.name && typeof body.name === "string" ? body.name.trim() || undefined : undefined,
    slug: body?.name && typeof body.name === "string" && body.name.trim() ? toSlug(body.name.trim()) : undefined,
    updatedAt: nowIso(),
    currentState: body?.currentState && typeof body.currentState === "string" ? body.currentState : undefined,
    primaryPrompt: body?.primaryPrompt && typeof body.primaryPrompt === "string" ? body.primaryPrompt : undefined,
    description: body?.description && typeof body.description === "string" ? body.description : undefined,
  });

  const workspace = await repo.getWorkspace(projectId, userId);
  const normalized = normalizeWorkspace(workspace);
  if (!normalized) {
    return NextResponse.json({ error: { code: "WORKSPACE_INVALID", message: "Project workspace could not be loaded." } }, { status: 500 });
  }
  return NextResponse.json(normalized, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
