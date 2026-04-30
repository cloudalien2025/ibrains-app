type HeadersLike = {
  get(name: string): string | null | undefined;
};

type NextUrlLike = {
  origin?: string;
  protocol?: string;
  host?: string;
};

export type CasaHudOriginRequestLike = {
  headers?: HeadersLike;
  nextUrl?: NextUrlLike;
  url?: string;
};

const CASA_HUD_PUBLIC_APP_ORIGIN_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "APP_PUBLIC_URL",
  "APP_URL",
] as const;

const CASA_HUD_PRODUCTION_FALLBACK_ORIGIN = "https://app.ibrains.ai";
const CASA_HUD_LOCAL_DEV_FALLBACK_ORIGIN = "http://localhost:3001";

function firstHeaderValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);
  return first || null;
}

function normalizeHttpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function extractHttpProtocol(value: string | null | undefined): string | null {
  const origin = normalizeHttpOrigin(value);
  if (!origin) return null;
  try {
    return new URL(origin).protocol;
  } catch {
    return null;
  }
}

function normalizeHost(value: string | null | undefined): string | null {
  const first = firstHeaderValue(value);
  if (!first) return null;
  return first.replace(/^https?:\/\//i, "").split("/")[0]?.trim() || null;
}

function toOriginFromHostAndProto(host: string | null | undefined, proto: string | null | undefined): string | null {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;
  const normalizedProto = firstHeaderValue(proto)?.replace(/:$/, "").toLowerCase();
  const scheme = normalizedProto === "http" || normalizedProto === "https" ? normalizedProto : "https";
  return normalizeHttpOrigin(`${scheme}://${normalizedHost}`);
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

function isLocalOrPrivateHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized === "::1" || normalized === "[::1]") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return isPrivateIpv4(normalized);
}

function isLocalOrPrivateOrigin(origin: string): boolean {
  try {
    return isLocalOrPrivateHostname(new URL(origin).hostname);
  } catch {
    return true;
  }
}

function resolveConfiguredOrigin(): string | null {
  for (const envKey of CASA_HUD_PUBLIC_APP_ORIGIN_ENV_KEYS) {
    const resolved = normalizeHttpOrigin(process.env[envKey]);
    if (resolved) return resolved;
  }
  return null;
}

function resolveRequestOrigin(request: CasaHudOriginRequestLike | undefined): string | null {
  if (!request) return null;
  const headers = request.headers;
  const forwardedHost = normalizeHost(headers?.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(headers?.get("x-forwarded-proto"));
  const hostHeader = normalizeHost(headers?.get("host"));

  const nextUrlProtocol = request.nextUrl?.protocol || extractHttpProtocol(request.nextUrl?.origin);
  const urlProtocol = extractHttpProtocol(request.url);
  const protocolHint = forwardedProto || nextUrlProtocol || urlProtocol || "https";

  const forwardedOrigin = toOriginFromHostAndProto(forwardedHost, protocolHint);
  if (forwardedOrigin) return forwardedOrigin;

  const hostOrigin = toOriginFromHostAndProto(hostHeader, protocolHint);
  if (hostOrigin) return hostOrigin;

  const nextUrlOrigin = normalizeHttpOrigin(request.nextUrl?.origin);
  if (nextUrlOrigin) return nextUrlOrigin;

  return normalizeHttpOrigin(request.url);
}

function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function resolveFallbackOrigin(): string {
  return isProductionRuntime() ? CASA_HUD_PRODUCTION_FALLBACK_ORIGIN : CASA_HUD_LOCAL_DEV_FALLBACK_ORIGIN;
}

export function resolveCasaHudPublicAppOrigin(request?: CasaHudOriginRequestLike): string {
  const configured = resolveConfiguredOrigin();
  if (configured) return configured;

  const requestOrigin = resolveRequestOrigin(request);
  if (requestOrigin && (!isProductionRuntime() || !isLocalOrPrivateOrigin(requestOrigin))) {
    return requestOrigin;
  }

  return resolveFallbackOrigin();
}

export function resolveCasaHudPublicAppOriginFromBrowser(browserOrigin?: string): string {
  const configured = resolveConfiguredOrigin();
  if (configured) return configured;

  const candidate = normalizeHttpOrigin(browserOrigin || "");
  if (candidate && (!isProductionRuntime() || !isLocalOrPrivateOrigin(candidate))) {
    return candidate;
  }

  return resolveFallbackOrigin();
}
