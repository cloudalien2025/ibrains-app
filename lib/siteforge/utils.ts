export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "home";
}

export function clampProgress(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sectionHtml(title: string, body: string, cta?: string): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeCta = cta ? `<p><strong>${escapeHtml(cta)}</strong></p>` : "";
  return `<section><h2>${safeTitle}</h2><p>${safeBody}</p>${safeCta}</section>`;
}
