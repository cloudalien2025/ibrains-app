function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

const KNOWN_RELATIVE_PREFIXES = ["uploads/", "images/", "forms/", "assets/", "user_images/"];

export function normalizeBdUrl(input: {
  bdBaseUrl: string;
  value: string | null | undefined;
}): string | null {
  const raw = clean(input.value);
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  const base = normalizeBaseUrl(input.bdBaseUrl);

  if (raw.startsWith("/")) {
    return `${base}${raw}`;
  }

  const lowered = raw.toLowerCase();
  if (KNOWN_RELATIVE_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
    return `${base}/${raw.replace(/^\/+/, "")}`;
  }

  return `${base}/${raw.replace(/^\/+/, "")}`;
}
