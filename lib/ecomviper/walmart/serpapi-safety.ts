import "server-only";

const MAX_SERPAPI_SAFE_DETAIL_LENGTH = 240;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function sanitizeSensitiveUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const next = new URL(parsed.toString());
    for (const key of Array.from(next.searchParams.keys())) {
      if (/(api[_-]?key|token|secret|authorization|auth|signature|sig|access[_-]?key)/i.test(key)) {
        next.searchParams.set(key, "[REDACTED]");
      }
    }
    return next.toString().replace(/%5BREDACTED%5D/gi, "[REDACTED]");
  } catch {
    return value;
  }
}

function sanitizeErrorLine(line: string): string {
  return line
    .replace(/([?&]api_key=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key\s*(?:=|:)\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(bearer\s+)[a-z0-9\-._~+/]+=*/gi, "$1[REDACTED]")
    .replace(/(token\s*(?:=|:)\s*)([a-z0-9\-._~+/]{4,})/gi, "$1[REDACTED]")
    .replace(/\b[a-z0-9_\-+/]{32,}\b/gi, "[REDACTED]");
}

export function sanitizeSerpApiErrorDetail(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;

  const normalized = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^at\s.+/i.test(line) && !/^stack[:\s]/i.test(line))
    .slice(0, 4)
    .map((line) => sanitizeErrorLine(line))
    .join(" ");

  const withSanitizedUrls = normalized.replace(/https?:\/\/[^\s)]+/gi, (url) =>
    sanitizeSensitiveUrl(url)
  );
  const compact = withSanitizedUrls.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.length <= MAX_SERPAPI_SAFE_DETAIL_LENGTH) return compact;
  return `${compact.slice(0, MAX_SERPAPI_SAFE_DETAIL_LENGTH - 3).trimEnd()}...`;
}

export function extractSerpApiErrorDetail(
  payload: unknown,
  options?: { includeGenericMessage?: boolean }
): string | null {
  const root = asObject(payload) ?? {};
  const searchMetadata = asObject(root.search_metadata);
  const errorEntries = asObjectArray(root.errors).flatMap((entry) => [
    asString(entry.message),
    asString(entry.detail),
    asString(entry.error),
    asString(entry.description),
    asString(entry.code),
  ]);

  const searchMetadataStatus = asString(searchMetadata?.status);
  const candidates = [
    asString(root.error),
    asString(searchMetadata?.error),
    /error|failed|invalid|forbidden|unauthorized|limited/i.test(searchMetadataStatus)
      ? searchMetadataStatus
      : "",
    ...errorEntries,
  ];

  if (options?.includeGenericMessage) {
    candidates.push(asString(root.message), asString(root.error_message));
  }

  const merged = Array.from(new Set(candidates.map((entry) => entry.trim()).filter(Boolean))).join("; ");
  return sanitizeSerpApiErrorDetail(merged);
}
