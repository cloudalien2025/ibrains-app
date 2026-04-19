export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { SiteForgeProject } from "@/lib/siteforge/contracts";
import { maybeSiteForgePersistenceErrorResponse } from "@/lib/siteforge/apiErrors";
import { parseWebsiteBrief } from "@/lib/siteforge/brief";
import { createId, nowIso, toSlug } from "@/lib/siteforge/utils";
import { normalizeProject } from "@/lib/siteforge/workspaceShape";

export async function GET() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  try {
    const repo = await getSiteForgeRepository();
    const lastOpenedProjectId = await repo.getLastOpenedProjectId(userId);
    const projects = (await repo.listProjects(userId))
      .map((project) => normalizeProject(project))
      .filter((project): project is NonNullable<ReturnType<typeof normalizeProject>> => Boolean(project));
    return NextResponse.json({ projects, lastOpenedProjectId }, { status: 200 });
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load SiteForge projects." } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Project name is required." } },
      { status: 400 }
    );
  }
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : "AI-generated website build project";
  const primaryPrompt =
    typeof body?.primaryPrompt === "string" && body.primaryPrompt.trim() ? body.primaryPrompt.trim() : null;
  const websiteBrief = parseWebsiteBrief(body?.websiteBrief);

  const now = nowIso();
  const project: SiteForgeProject = {
    id: createId("sfp"),
    userId,
    name,
    slug: toSlug(name),
    status: "draft",
    siteType: null,
    primaryPrompt,
    websiteBrief,
    currentState: "workspace",
    homepageStrategy: "use_existing",
    aiProvider: "openai",
    aiModel: "gpt-4.1-mini",
    aiSecretRef: null,
    hasSavedAiSecret: false,
    lastOpenedAt: now,
    description,
    latestSessionId: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const repo = await getSiteForgeRepository();
    await repo.createProject(project);
    await repo.markProjectOpened(userId, project.id);
    return NextResponse.json({ project: normalizeProject(project) }, { status: 201 });
  } catch (error: unknown) {
    const persistenceError = maybeSiteForgePersistenceErrorResponse(error);
    if (persistenceError) return persistenceError;
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create SiteForge project." } },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
