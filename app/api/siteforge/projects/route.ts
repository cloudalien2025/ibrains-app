export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { SiteForgeProject } from "@/lib/siteforge/contracts";
import { createId, nowIso } from "@/lib/siteforge/utils";

export async function GET() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign-in required" } }, { status: 401 });
  }

  const repo = await getSiteForgeRepository();
  const projects = await repo.listProjects(userId);
  return NextResponse.json({ projects }, { status: 200 });
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

  const now = nowIso();
  const project: SiteForgeProject = {
    id: createId("sfp"),
    userId,
    name,
    description,
    latestSessionId: null,
    createdAt: now,
    updatedAt: now,
  };

  const repo = await getSiteForgeRepository();
  await repo.createProject(project);
  return NextResponse.json({ project }, { status: 201 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
