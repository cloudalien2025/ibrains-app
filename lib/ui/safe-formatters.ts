export function safeIsoDate(value: string | null | undefined, fallback = "Unknown"): string {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  try {
    return new Date(parsed).toISOString();
  } catch {
    return fallback;
  }
}

export function safeMoney(
  value: number | null | undefined,
  options?: { currency?: string; fallback?: string }
): string {
  const fallback = options?.fallback ?? "Unknown";
  if (value == null || !Number.isFinite(value)) return fallback;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: options?.currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return fallback;
  }
}
