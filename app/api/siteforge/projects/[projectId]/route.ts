export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";

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
  const project = await repo.getProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
  }

  const sessions = await repo.listSessions(projectId, userId);
  return NextResponse.json({ project, sessions }, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
