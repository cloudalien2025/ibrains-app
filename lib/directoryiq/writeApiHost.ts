const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";

function normalizeBase(raw: string, envName: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${envName} must use http or https`);
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid ${envName}: ${error.message}` : `Invalid ${envName}`);
  }
}

export function resolveDirectoryIqWriteApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE ?? DEFAULT_DIRECTORYIQ_API_BASE;
  return normalizeBase(raw, "NEXT_PUBLIC_DIRECTORYIQ_API_BASE");
}

export function buildDirectoryIqWriteApiUrl(pathname: string, search = ""): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const target = new URL(normalizedPath, `${resolveDirectoryIqWriteApiBase()}/`);

  const normalizedSearch = search.trim().replace(/^\?/, "");
  if (normalizedSearch) {
    target.search = normalizedSearch;
  }

  return target.toString();
}
