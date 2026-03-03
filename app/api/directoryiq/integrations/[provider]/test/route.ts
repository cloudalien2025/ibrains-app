export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqIntegrationSecret, isDirectoryIqProvider } from "@/app/api/directoryiq/_utils/credentials";

function errorResponse(status: number, message: string, code: string, reqId = crypto.randomUUID()) {
  return NextResponse.json({ error: { message, code, reqId } }, { status });
}

async function testBrilliantDirectories(params: { baseUrl: string; apiKey: string }): Promise<{ ok: true; message: string }> {
  const url = new URL("/api/v2/user/get/1", params.baseUrl).toString();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Api-Key": params.apiKey,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`BD API test failed with status ${response.status}`);
  }
  return { ok: true, message: "Connected to Brilliant Directories API" };
}

async function testOpenAi(apiKey: string): Promise<{ ok: true; message: string }> {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenAI API test failed with status ${response.status}`);
  }
  return { ok: true, message: "Connected to OpenAI API" };
}

async function testSerpApi(apiKey: string): Promise<{ ok: true; message: string }> {
  const url = `https://serpapi.com/account.json?api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`SerpAPI test failed with status ${response.status}`);
  }
  return { ok: true, message: "Connected to SerpAPI" };
}

async function testGa4(params: { measurementId: string; apiSecret: string }): Promise<{ ok: true; message: string }> {
  const measurementOk = /^G-[A-Z0-9]+$/i.test(params.measurementId);
  const secretOk = params.apiSecret.length >= 6;
  if (!measurementOk || !secretOk) {
    throw new Error("Invalid GA4 credentials format.");
  }
  return { ok: true, message: "GA4 credentials format validated." };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const reqId = crypto.randomUUID();
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { provider } = params;
    const resolvedProvider = provider.trim().toLowerCase();
    if (!isDirectoryIqProvider(resolvedProvider)) {
      return errorResponse(400, "Unsupported provider.", "BAD_PROVIDER", reqId);
    }

    const credential = await getDirectoryIqIntegrationSecret(userId, resolvedProvider);
    if (!credential) {
      return errorResponse(
        400,
        "Provider credentials are not configured. Save credentials first.",
        "NOT_CONFIGURED",
        reqId
      );
    }

    if (resolvedProvider === "brilliant_directories") {
      const baseUrl = typeof credential.meta.baseUrl === "string" ? credential.meta.baseUrl.trim() : "";
      if (!baseUrl) {
        return errorResponse(400, "baseUrl is required for Brilliant Directories.", "VALIDATION_ERROR", reqId);
      }
      const result = await testBrilliantDirectories({ baseUrl, apiKey: credential.secret });
      return NextResponse.json({ ...result, reqId });
    }
    if (resolvedProvider === "openai") {
      const result = await testOpenAi(credential.secret);
      return NextResponse.json({ ...result, reqId });
    }
    if (resolvedProvider === "serpapi") {
      const result = await testSerpApi(credential.secret);
      return NextResponse.json({ ...result, reqId });
    }
    const measurementId = typeof credential.meta.measurementId === "string" ? credential.meta.measurementId.trim() : "";
    const result = await testGa4({ measurementId, apiSecret: credential.secret });
    return NextResponse.json({ ...result, reqId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown test error";
    return errorResponse(502, message, "TEST_FAILED", reqId);
  }
}
