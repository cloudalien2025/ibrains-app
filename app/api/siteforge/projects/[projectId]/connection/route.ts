export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { ConnectionProfile } from "@/lib/siteforge/contracts";
import { getSiteForgeRepository } from "@/lib/siteforge/repository";
import { createId, nowIso } from "@/lib/siteforge/utils";
import { resolveRuntimeConnection, saveConnectionProfile } from "@/lib/siteforge/workspace";
import { validateWordPressConnection } from "@/lib/siteforge/wordpress/service";

function parseIncomingConnection(body: Record<string, unknown> | null): ConnectionProfile | null {
  const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const appPassword = typeof body?.appPassword === "string" ? body.appPassword.trim() : "";
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : "WordPress";

  if (!baseUrl || !username) return null;

  return {
    id: typeof body?.connectionId === "string" && body.connectionId.trim() ? body.connectionId.trim() : createId("conn"),
    label,
    baseUrl,
    username,
    appPassword: appPassword || undefined,
    hasThriveHint: body?.hasThriveHint === true,
    lastValidatedAt: nowIso(),
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
  const repo = await getSiteForgeRepository();
  const project = await repo.getProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const incoming = parseIncomingConnection(body);

  if (!incoming) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "baseUrl and username are required." } },
      { status: 400 }
    );
  }

  const resolved = await resolveRuntimeConnection({
    repo,
    projectId,
    incoming,
    preferConnectionId: incoming.id,
  });

  if (!resolved.connection?.appPassword) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Application password is required for initial validation." } },
      { status: 400 }
    );
  }

  const result = await validateWordPressConnection(resolved.connection);
  const saved = await saveConnectionProfile({
    repo,
    projectId,
    connection: resolved.connection,
    validation: result,
  });

  await repo.updateProject(projectId, {
    status: result.connected ? "active" : "draft",
    siteType: result.thriveDetected ? "thrive" : null,
    currentState: "workspace",
  });

  return NextResponse.json(
    {
      result,
      connection: saved,
      credentialsSaved: saved.hasSavedSecret,
    },
    { status: 200 }
  );
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
  const repo = await getSiteForgeRepository();
  const project = await repo.getProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const current = await repo.getProjectConnection(projectId);

  const incoming = parseIncomingConnection(
    body
      ? {
          ...body,
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : current?.wordpressUrl,
          username: typeof body.username === "string" ? body.username : current?.username,
          label: typeof body.label === "string" ? body.label : current?.label,
          connectionId: current?.connectionId,
        }
      : null
  );

  if (!incoming) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "No saved connection to revalidate." } },
      { status: 400 }
    );
  }

  const resolved = await resolveRuntimeConnection({
    repo,
    projectId,
    incoming,
    preferConnectionId: current?.connectionId ?? incoming.id,
  });

  if (!resolved.connection?.appPassword) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Credentials not saved. Provide application password to revalidate." } },
      { status: 400 }
    );
  }

  const result = await validateWordPressConnection(resolved.connection);
  const saved = await saveConnectionProfile({
    repo,
    projectId,
    connection: resolved.connection,
    validation: result,
  });

  return NextResponse.json({ result, connection: saved, credentialsSaved: saved.hasSavedSecret }, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
