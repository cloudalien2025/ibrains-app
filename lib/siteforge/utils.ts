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

function linesFromBody(body: string): string[] {
  return body
    .split(/\n|<br\s*\/?>/i)
    .map((entry) => entry.replace(/^[\-\u2022\*]\s*/, "").trim())
    .filter(Boolean);
}

function safeButton(label: string): string {
  return `<a class="sf-btn" href="#contact" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</a>`;
}

export function siteforgeVisualStyles(): string {
  return `<style>
.sf-wrap{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a}
.sf-section{margin:0;padding:56px 24px;border-radius:20px}
.sf-section + .sf-section{margin-top:18px}
.sf-section h2{margin:0 0 12px;font-size:clamp(1.35rem,2.1vw,2rem);line-height:1.2}
.sf-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0ea5e9;margin:0 0 10px}
.sf-lede{font-size:1.03rem;line-height:1.65;color:#334155;margin:0}
.sf-grid{display:grid;gap:14px}
.sf-grid-3{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.sf-card{background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:16px;box-shadow:0 8px 22px rgba(15,23,42,.06)}
.sf-band-accent{background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff}
.sf-band-muted{background:#f8fafc}
.sf-band-contrast{background:#0b1f3a;color:#e2e8f0}
.sf-band-accent .sf-lede,.sf-band-contrast .sf-lede{color:inherit}
.sf-btn{display:inline-block;margin-top:16px;background:#0ea5e9;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px}
.sf-btn.secondary{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45)}
.sf-toggle summary{cursor:pointer;font-weight:700;padding:12px 0}
.sf-toggle p{margin:0 0 10px;color:#475569}
.sf-trust{display:flex;flex-wrap:wrap;gap:10px}
.sf-badge{font-size:.85rem;background:#e2e8f0;border-radius:999px;padding:8px 12px}
.sf-mockup{border:1px solid #bfdbfe;background:linear-gradient(160deg,#eff6ff,#dbeafe);border-radius:16px;min-height:200px;display:flex;align-items:center;justify-content:center;color:#1e3a8a;font-weight:700}
</style>`;
}

export function sectionHtml(
  title: string,
  body: string,
  cta?: string,
  options?: {
    visualPattern?: string | null;
    sectionBandStyle?: string | null;
  }
): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeCta = cta ? `<p><strong>${escapeHtml(cta)}</strong></p>` : "";
  const pattern = options?.visualPattern ?? "";
  const band = options?.sectionBandStyle === "accent" ? "sf-band-accent" : options?.sectionBandStyle === "dark" ? "sf-band-contrast" : options?.sectionBandStyle === "light" ? "sf-band-muted" : "";
  const points = linesFromBody(body);

  if (pattern === "feature_cards_grid" || pattern === "icon_benefits_row" || pattern === "testimonial_cards") {
    const cards = (points.length ? points : [body])
      .slice(0, 6)
      .map((entry) => `<article class="sf-card"><p class="sf-lede">${escapeHtml(entry)}</p></article>`)
      .join("");
    return `<section class="sf-section ${band}"><p class="sf-kicker">Highlights</p><h2>${safeTitle}</h2><div class="sf-grid sf-grid-3">${cards}</div>${cta ? safeButton(cta) : ""}</section>`;
  }

  if (pattern === "faq_toggle") {
    const faqItems = (points.length ? points : [body]).slice(0, 5);
    const toggles = faqItems
      .map((entry, idx) => {
        const [q, a] = entry.includes("?") ? [entry, body] : [`Question ${idx + 1}`, entry];
        return `<details class="sf-toggle"><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`;
      })
      .join("");
    return `<section class="sf-section ${band}"><p class="sf-kicker">FAQ</p><h2>${safeTitle}</h2>${toggles}${cta ? safeButton(cta) : ""}</section>`;
  }

  if (pattern === "cta_band") {
    return `<section class="sf-section sf-band-accent"><p class="sf-kicker">Next Step</p><h2>${safeTitle}</h2><p class="sf-lede">${safeBody}</p>${safeButton(cta || "Get Started")}</section>`;
  }

  if (pattern === "app_mockup_showcase" || pattern === "hero_split" || pattern === "hero_centered") {
    return `<section class="sf-section ${band || "sf-band-muted"}"><p class="sf-kicker">Product</p><h2>${safeTitle}</h2><p class="sf-lede">${safeBody}</p><div class="sf-mockup">App Preview Area</div>${cta ? safeButton(cta) : ""}</section>`;
  }

  if (pattern === "trust_strip") {
    const badges = (points.length ? points : ["Trusted by growing teams", "Reliable support", "Secure infrastructure"])
      .slice(0, 5)
      .map((entry) => `<span class="sf-badge">${escapeHtml(entry)}</span>`)
      .join("");
    return `<section class="sf-section sf-band-muted"><h2>${safeTitle}</h2><div class="sf-trust">${badges}</div>${cta ? safeButton(cta) : ""}</section>`;
  }

  return `<section class="sf-section ${band}"><h2>${safeTitle}</h2><p class="sf-lede">${safeBody}</p>${safeCta}</section>`;
}
