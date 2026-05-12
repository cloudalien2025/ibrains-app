import type { NextRequest } from "next/server";

const PUBLIC_ORIGIN_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "APP_PUBLIC_URL",
  "APP_URL",
] as const;

const PRODUCTION_FALLBACK_ORIGIN = "https://app.ibrains.ai";
const LOCAL_FALLBACK_ORIGIN = "http://localhost:3001";

function firstHeaderValue(value: string | null): string {
  if (!value) return "";
  return (
    value
      .split(",")
      .map((part) => part.trim())
      .find(Boolean) ?? ""
  );
}

function normalizeOrigin(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function normalizeHost(value: string | null | undefined): string {
  const first = firstHeaderValue(value ?? null);
  if (!first) return "";
  return first.replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? "";
}

function normalizedProtocol(value: string | null | undefined): "http" | "https" | "" {
  const first = firstHeaderValue(value ?? null).replace(/:$/, "").toLowerCase();
  if (first === "http" || first === "https") return first;
  return "";
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((value) => Number(value));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLocalOrPrivateHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return true;
  try {
    const hostname = new URL(`http://${normalized}`).hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
    if (hostname === "::1" || hostname === "[::1]") return true;
    if (hostname.startsWith("fe80:")) return true;
    if (hostname.startsWith("fc") || hostname.startsWith("fd")) return true;
    return isPrivateIpv4(hostname);
  } catch {
    return true;
  }
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function resolveConfiguredOrigin(): string {
  for (const key of PUBLIC_ORIGIN_ENV_KEYS) {
    const candidate = normalizeOrigin(process.env[key]);
    if (candidate) return candidate;
  }
  return "";
}

function originFromHost(host: string, proto: "http" | "https" | ""): string {
  if (!host) return "";
  const scheme = proto || (isLocalOrPrivateHost(host) ? "http" : "https");
  return normalizeOrigin(`${scheme}://${host}`);
}

export function resolveEcomViperPublicAppOrigin(request: Pick<NextRequest, "headers" | "nextUrl">): string {
  const configured = resolveConfiguredOrigin();
  if (configured) return configured;

  const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"));
  const forwardedProto = normalizedProtocol(request.headers.get("x-forwarded-proto"));
  const host = normalizeHost(request.headers.get("host"));
  const nextUrlOrigin = normalizeOrigin(request.nextUrl?.origin);

  const forwardedOrigin = originFromHost(forwardedHost, forwardedProto);
  if (forwardedOrigin) return forwardedOrigin;

  const hostOrigin = originFromHost(host, forwardedProto);
  if (hostOrigin && (!isProductionRuntime() || !isLocalOrPrivateHost(host))) {
    return hostOrigin;
  }

  if (nextUrlOrigin && (!isProductionRuntime() || !isLocalOrPrivateHost(new URL(nextUrlOrigin).host))) {
    return nextUrlOrigin;
  }

  return isProductionRuntime() ? PRODUCTION_FALLBACK_ORIGIN : LOCAL_FALLBACK_ORIGIN;
}

