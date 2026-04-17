export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { SiteForgeProject } from "@/lib/siteforge/contracts";
import { createId, nowIso, toSlug } from "@/lib/siteforge/utils";
import { normalizeProject } from "@/lib/siteforge/workspaceShape";

export async function GET() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const repo = await getSiteForgeRepository();
  const lastOpenedProjectId = await repo.getLastOpenedProjectId(userId);
  const projects = (await repo.listProjects(userId))
    .map((project) => normalizeProject(project))
    .filter((project): project is NonNullable<ReturnType<typeof normalizeProject>> => Boolean(project));
  return NextResponse.json({ projects, lastOpenedProjectId }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled SiteForge Project";
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : "AI-generated website build project";
  const primaryPrompt =
    typeof body?.primaryPrompt === "string" && body.primaryPrompt.trim() ? body.primaryPrompt.trim() : null;

  const now = nowIso();
  const project: SiteForgeProject = {
    id: createId("sfp"),
    userId,
    name,
    slug: toSlug(name),
    status: "draft",
    siteType: null,
    primaryPrompt,
    currentState: "workspace",
    homepageStrategy: "use_existing",
    lastOpenedAt: now,
    description,
    latestSessionId: null,
    createdAt: now,
    updatedAt: now,
  };

  const repo = await getSiteForgeRepository();
  await repo.createProject(project);
  await repo.markProjectOpened(userId, project.id);
  return NextResponse.json({ project: normalizeProject(project) }, { status: 201 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
