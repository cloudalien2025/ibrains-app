export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import { resolveConnection } from "@/lib/siteforge/api";
import { validateWordPressConnection } from "@/lib/siteforge/wordpress/service";

export async function POST(req: NextRequest) {
  const { unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const connection = resolveConnection({
    prompt: "validate",
    connection:
      body && typeof body === "object"
        ? {
            label: typeof body.label === "string" ? body.label : undefined,
            baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
            username: typeof body.username === "string" ? body.username : undefined,
            appPassword: typeof body.appPassword === "string" ? body.appPassword : undefined,
            hasThriveHint: body.hasThriveHint === true,
          }
        : undefined,
  });

  if (!connection) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "baseUrl, username, and appPassword are required." } },
      { status: 400 }
    );
  }

  const result = await validateWordPressConnection(connection);
  return NextResponse.json({ result }, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
