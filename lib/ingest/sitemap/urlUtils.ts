import crypto from "crypto";

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("base_url is required");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = "";
  return `${parsed.protocol}//${parsed.host}`;
}

export function normalizeAbsoluteUrl(input: string): string | null {
  try {
    const parsed = new URL(input);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    parsed.hash = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function toAbsoluteUrl(input: string, baseUrl: string): string | null {
  try {
    const value = new URL(input, baseUrl).toString();
    return normalizeAbsoluteUrl(value);
  } catch {
    return null;
  }
}

export function urlHash(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

export function sameHost(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}
