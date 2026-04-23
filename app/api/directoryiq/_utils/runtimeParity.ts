import { NextRequest } from "next/server";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";
const DIRECTORYIQ_RUNTIME_MODE_LOCAL = "local";
const DIRECTORYIQ_RUNTIME_MODE_PROXY = "proxy";

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

function shouldProxyByRuntimeMode(): boolean {
  const runtimeMode = (process.env.DIRECTORYIQ_RUNTIME_MODE ?? "").trim().toLowerCase();
  if (runtimeMode === DIRECTORYIQ_RUNTIME_MODE_PROXY) return true;
  if (runtimeMode === DIRECTORYIQ_RUNTIME_MODE_LOCAL) return false;

  const legacyProxyMode = (process.env.DIRECTORYIQ_PROXY_MODE ?? "").trim().toLowerCase();
  return legacyProxyMode === "external" || legacyProxyMode === DIRECTORYIQ_RUNTIME_MODE_PROXY;
}

export function shouldServeDirectoryIqLocally(req: NextRequest): boolean {
  // Monorepo default is local-first. External proxy mode must be explicitly enabled.
  if (!shouldProxyByRuntimeMode()) return true;
  return requestHost(req) === targetHost();
}
