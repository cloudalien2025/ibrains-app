export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/api/ecomviper/walmart/_utils/response";
import { requireSignedInUser } from "@/lib/auth/requireSignedInUser";
import {
  createWalmartNetworkConnectionForUser,
  deleteWalmartNetworkConnectionForUser,
  listWalmartNetworkConnectionsForUser,
  updateWalmartNetworkConnectionForUser,
} from "@/lib/ecomviper/walmart/walmart-network-connections-repository";
import type { WalmartNetworkConnectionInput } from "@/lib/ecomviper/walmart/walmart-network-connections";

async function requireUser() {
  const { userId, unauthorizedResponse } = await requireSignedInUser();
  if (unauthorizedResponse) {
    if (unauthorizedResponse.status !== 401) {
      return { userId: null, response: unauthorizedResponse };
    }
    return {
      userId: null,
      response: fail(401, "Please sign in before managing Walmart network connections.", "UNAUTHORIZED"),
    };
  }
  if (!userId) {
    return {
      userId: null,
      response: fail(401, "Please sign in before managing Walmart network connections.", "UNAUTHORIZED"),
    };
  }
  return { userId, response: null };
}

function parseBody(body: unknown): WalmartNetworkConnectionInput {
  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const guardrailsRaw =
    record.guardrails && typeof record.guardrails === "object" && !Array.isArray(record.guardrails)
      ? (record.guardrails as Record<string, unknown>)
      : undefined;

  const asList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
  };

  return {
    name: typeof record.name === "string" ? record.name : "",
    platform:
      record.platform === "walmart" || record.platform === "wordpress" || record.platform === "other"
        ? record.platform
        : "wordpress",
    url: typeof record.url === "string" ? record.url : undefined,
    status:
      record.status === "connected" || record.status === "needs_attention" || record.status === "not_connected"
        ? record.status
        : "connected",
    credentialLabel: typeof record.credentialLabel === "string" ? record.credentialLabel : undefined,
    applicationPassword:
      typeof record.applicationPassword === "string" ? record.applicationPassword : undefined,
    defaultPublishingStatus:
      record.defaultPublishingStatus === "pending_review" ? "pending_review" : "draft",
    defaultCategory: typeof record.defaultCategory === "string" ? record.defaultCategory : undefined,
    defaultAuthor: typeof record.defaultAuthor === "string" ? record.defaultAuthor : undefined,
    publishingMode:
      record.publishingMode === "approval_required" || record.publishingMode === "manual_copy"
        ? record.publishingMode
        : "draft_only",
    guardrails: guardrailsRaw
      ? {
          primaryNiche:
            typeof guardrailsRaw.primaryNiche === "string" ? guardrailsRaw.primaryNiche : undefined,
          secondaryNiches: asList(guardrailsRaw.secondaryNiches),
          allowedTopics: asList(guardrailsRaw.allowedTopics),
          blockedTopics: asList(guardrailsRaw.blockedTopics),
          preferredContentTypes: asList(guardrailsRaw.preferredContentTypes),
          audience: typeof guardrailsRaw.audience === "string" ? guardrailsRaw.audience : undefined,
          notesForIBrains:
            typeof guardrailsRaw.notesForIBrains === "string" ? guardrailsRaw.notesForIBrains : undefined,
        }
      : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
  };
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const connections = await listWalmartNetworkConnectionsForUser(auth.userId);
    return ok({ ok: true, connections });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to load Walmart network connections."
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await req.json().catch(() => ({}))) as unknown;
    const connection = await createWalmartNetworkConnectionForUser({
      userId: auth.userId,
      connection: parseBody(body),
    });

    return ok({
      ok: true,
      connection,
      message: "Network connection saved.",
      securityNote: "Application passwords are accepted for save requests only and are never returned.",
    });
  } catch (error) {
    return fail(
      400,
      error instanceof Error ? error.message : "Failed to save Walmart network connection.",
      "VALIDATION_ERROR"
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await req.json().catch(() => ({}))) as unknown;
    const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const connectionId = typeof record.connectionId === "string" ? record.connectionId.trim() : "";
    if (!connectionId) {
      return fail(400, "connectionId is required.", "VALIDATION_ERROR");
    }

    const connection = await updateWalmartNetworkConnectionForUser({
      userId: auth.userId,
      connectionId,
      connection: parseBody(record),
    });

    return ok({ ok: true, connection, message: "Network connection updated." });
  } catch (error) {
    return fail(
      400,
      error instanceof Error ? error.message : "Failed to update Walmart network connection.",
      "VALIDATION_ERROR"
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const connectionId = req.nextUrl.searchParams.get("connectionId")?.trim() ?? "";
    if (!connectionId) {
      return fail(400, "connectionId is required.", "VALIDATION_ERROR");
    }

    await deleteWalmartNetworkConnectionForUser({
      userId: auth.userId,
      connectionId,
    });

    return ok({ ok: true, message: "Network connection removed." });
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : "Failed to delete Walmart network connection."
    );
  }
}
