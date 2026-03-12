import { NextRequest, NextResponse } from "next/server";
import { resolveDirectoryIqUserId } from "@/app/api/directoryiq/_utils/userContext";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "authorization",
  "cf-access-jwt-assertion",
  "cf-access-authenticated-user-email",
  "cookie",
  "x-forwarded-email",
  "x-user-email",
  "x-user-id",
] as const;

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

function buildForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const key of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (!headers.has("x-user-id")) {
    headers.set("x-user-id", resolveDirectoryIqUserId(req));
  }
  return headers;
}

export async function proxyDirectoryIqRead(req: NextRequest, upstreamPathname: string): Promise<NextResponse> {
  return proxyDirectoryIqRequest(req, upstreamPathname, "GET");
}

export async function proxyDirectoryIqRequest(
  req: NextRequest,
  upstreamPathname: string,
  method: "GET" | "POST" | "DELETE"
): Promise<NextResponse> {
  try {
    const base = resolveDirectoryIqApiBase();
    const target = new URL(upstreamPathname, `${base}/`);
    const search = req.nextUrl.searchParams.toString();
    if (search) target.search = search;

    const upstream = await fetch(target.toString(), {
      method,
      headers: buildForwardHeaders(req),
      cache: "no-store",
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach DirectoryIQ API";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
