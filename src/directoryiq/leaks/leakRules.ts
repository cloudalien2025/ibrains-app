import { canonicalizeUrl } from "@/src/directoryiq/utils/canonicalizeUrl";

export const WEAK_ANCHOR_STOPLIST = [
  "click here",
  "learn more",
  "read more",
  "more",
  "here",
  "this",
  "this link",
  "website",
  "details",
  "view",
  "see more",
];

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePathForMatch(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://directoryiq.local");
    return url.pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return raw.split("?")[0].split("#")[0].toLowerCase().replace(/\/+$/, "");
  }
}

export function normalizeHref(value: string): string {
  const canonical = canonicalizeUrl(value);
  if (canonical) return canonical;
  return normalizePathForMatch(value);
}

export function normalizeAnchorText(value: string): string {
  return normalizeForMatch(value);
}

export function normalizeMentionText(value: string): string {
  return normalizeForMatch(value);
}

export function isWeakAnchorText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length < 8) return true;
  const normalized = normalizeForMatch(trimmed);
  return WEAK_ANCHOR_STOPLIST.includes(normalized);
}

export function buildDeterministicAliases(name: string): string[] {
  const base = normalizeForMatch(name);
  if (!base) return [];
  const out = new Set<string>([base]);

  if (base.startsWith("the ")) {
    out.add(base.slice(4).trim());
  }

  out.add(base.replace(/\bat\b/g, " ").replace(/\s+/g, " ").trim());
  out.add(base.replace(/\b(hotel|inn|resort)\b/g, " ").replace(/\s+/g, " ").trim());

  return Array.from(out).filter((item) => item.length >= 3);
}

export type Anchor = { href: string; text: string };

export function extractAnchors(html: string): Anchor[] {
  const results: Anchor[] = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = regex.exec(html);

  while (match) {
    const href = (match[1] ?? "").trim();
    const text = stripHtml(match[2] ?? "");
    if (href) {
      results.push({ href, text });
    }
    match = regex.exec(html);
  }

  return results;
}
