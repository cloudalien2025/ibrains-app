import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRead } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getAuthorityOverview } from "@/src/directoryiq/graph/graphService";

export const runtime = "nodejs";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

function resolveDirectoryIqApiBase(): string {
  const raw = (
    process.env.DIRECTORYIQ_API_BASE ??
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE ??
    DEFAULT_DIRECTORYIQ_API_BASE
  )
    .trim()
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("DIRECTORYIQ_API_BASE must use http or https");
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid DIRECTORYIQ_API_BASE: ${error.message}`
        : "Invalid DIRECTORYIQ_API_BASE"
    );
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function requestHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded && forwarded.trim()) return normalizeHost(forwarded);
  const hostHeader = req.headers.get("host");
  if (hostHeader && hostHeader.trim()) return normalizeHost(hostHeader);
  return normalizeHost(req.nextUrl.host);
}

function targetHost(): string {
  return normalizeHost(new URL(resolveDirectoryIqApiBase()).host);
}

export async function GET(req: NextRequest) {
  if (requestHost(req) === targetHost()) {
    const reqId = crypto.randomUUID();

    try {
      const userId = resolveUserId(req);
      await ensureUser(userId);

      const overview = await getAuthorityOverview({ tenantId: "default", userId });
      return NextResponse.json({ ok: true, overview, reqId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load authority overview";
      return NextResponse.json(
        {
          ok: false,
          error: {
            message,
            code: "INTERNAL_ERROR",
            reqId,
          },
        },
        { status: 500 }
      );
    }
  }

  return proxyDirectoryIqRead(req, "/api/directoryiq/authority/overview");
}
