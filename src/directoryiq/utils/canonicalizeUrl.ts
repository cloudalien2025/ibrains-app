import { normalizeBdBaseUrl } from "@/app/api/directoryiq/_utils/bdApi";

export function canonicalizeUrl(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const base = normalizeBdBaseUrl(`${url.protocol}//${url.host}`);
    const path = url.pathname.replace(/\/+$/, "");
    return `${base}${path}`.toLowerCase();
  } catch {
    return normalizeBdBaseUrl(trimmed).replace(/\/+$/, "").toLowerCase();
  }
}
