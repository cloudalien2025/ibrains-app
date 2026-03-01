export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  deleteDirectoryIqIntegration,
  getDirectoryIqIntegration,
  isDirectoryIqProvider,
  saveDirectoryIqIntegration,
  type DirectoryIqProvider,
} from "@/app/api/directoryiq/_utils/credentials";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ error: { message, code, reqId } }, { status });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type SaveBody = {
  baseUrl?: string;
  apiKey?: string;
  measurementId?: string;
  apiSecret?: string;
  meta?: Record<string, unknown>;
};

function validateBody(provider: DirectoryIqProvider, body: SaveBody): {
  secret: string;
  meta: Record<string, unknown>;
} | { error: string } {
  const meta = (body.meta && typeof body.meta === "object" ? body.meta : {}) as Record<string, unknown>;
  if (provider === "brilliant_directories") {
    const baseUrl = asString(body.baseUrl);
    const apiKey = asString(body.apiKey);
    if (!baseUrl) return { error: "baseUrl is required." };
    if (!apiKey) return { error: "apiKey is required." };
    return {
      secret: apiKey,
      meta: {
        ...meta,
        baseUrl,
      },
    };
  }

  if (provider === "openai" || provider === "serpapi") {
    const apiKey = asString(body.apiKey);
    if (!apiKey) return { error: "apiKey is required." };
    return { secret: apiKey, meta };
  }

  const measurementId = asString(body.measurementId);
  const apiSecret = asString(body.apiSecret);
  if (!measurementId) return { error: "measurementId is required." };
  if (!apiSecret) return { error: "apiSecret is required." };
  return {
    secret: apiSecret,
    meta: {
      ...meta,
      measurementId,
    },
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(context.params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isDirectoryIqProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER");
    }
    const integration = await getDirectoryIqIntegration(userId, resolvedProvider);
    return NextResponse.json(integration);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration fetch error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(context.params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isDirectoryIqProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER");
    }

    const body = (await req.json().catch(() => ({}))) as SaveBody;
    const validated = validateBody(resolvedProvider, body);
    if ("error" in validated) {
      return errorResponse(400, validated.error, "VALIDATION_ERROR");
    }

    await saveDirectoryIqIntegration({
      userId,
      provider: resolvedProvider,
      secret: validated.secret,
      meta: validated.meta,
    });

    const integration = await getDirectoryIqIntegration(userId, resolvedProvider);
    return NextResponse.json(integration);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration save error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = await Promise.resolve(context.params);
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isDirectoryIqProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER");
    }
    await deleteDirectoryIqIntegration(userId, resolvedProvider);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration delete error";
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}
