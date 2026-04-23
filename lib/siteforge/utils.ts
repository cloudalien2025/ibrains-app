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

function safeButton(label: string, tone: "primary" | "secondary" = "primary"): string {
  const cls = tone === "secondary" ? "sf-btn secondary" : "sf-btn";
  return `<a class="${cls}" href="#contact" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</a>`;
}

function safeBullets(lines: string[], max = 4): string[] {
  return lines
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function siteforgeVisualStyles(): string {
  return `<style>
.sf-wrap{font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:1100px;margin:0 auto;padding:14px 0 44px}
.sf-page-head{padding:24px 24px 0;color:#0f172a}
.sf-page-head h1{margin:0;font-size:clamp(1.35rem,2.4vw,1.9rem);line-height:1.2}
.sf-page-head p{margin:8px 0 0;color:#334155;font-size:.95rem}
.sf-section{margin:0;padding:64px 24px;border-radius:28px;position:relative;overflow:hidden;border:1px solid #d9e4f0}
.sf-section + .sf-section{margin-top:18px}
.sf-space-compact{padding-top:44px;padding-bottom:44px}
.sf-space-comfortable{padding-top:56px;padding-bottom:56px}
.sf-space-spacious{padding-top:76px;padding-bottom:76px}
.sf-section h2{margin:0 0 12px;font-size:clamp(1.55rem,3.2vw,2.7rem);line-height:1.08;letter-spacing:-.02em}
.sf-kicker{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin:0 0 10px;font-weight:700}
.sf-lede{font-size:1.05rem;line-height:1.7;color:#334155;margin:0;max-width:72ch}
.sf-body{font-size:1rem;line-height:1.65;color:#334155;margin:12px 0 0}
.sf-grid{display:grid;gap:14px}
.sf-grid-3{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.sf-card{background:#fff;border:1px solid #d9e4f0;border-radius:16px;padding:18px;box-shadow:0 12px 28px rgba(15,23,42,.08)}
.sf-card h3{margin:0 0 8px;font-size:1rem}
.sf-band-accent{background:linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(34,211,238,0.08) 45%, rgba(255,255,255,0) 100%),#f4f8fc;color:#0f172a}
.sf-band-muted{background:#eaf1f8}
.sf-band-contrast{background:#f4f8fc;color:#0f172a}
.sf-band-accent .sf-lede,.sf-band-contrast .sf-lede,.sf-band-accent .sf-body,.sf-band-contrast .sf-body{color:#334155}
.sf-transition-accent:before{content:"";position:absolute;inset:-30% auto auto -20%;width:260px;height:260px;background:radial-gradient(circle,rgba(34,211,238,0.16),transparent 70%)}
.sf-transition-calm:before{content:"";position:absolute;inset:-20% -8% auto auto;width:220px;height:220px;background:radial-gradient(circle,rgba(34,211,238,0.10),transparent 70%)}
.sf-btn{display:inline-block;margin-top:16px;background:#2563eb;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;border:1px solid #2563eb;box-shadow:0 8px 20px rgba(37,99,235,.24)}
.sf-btn:hover{background:#1d4ed8;border-color:#1d4ed8}
.sf-btn.secondary{background:#fff;border:1px solid #d9e4f0;color:#0f172a!important;box-shadow:none}
.sf-btn-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.sf-toggle summary{cursor:pointer;font-weight:700;padding:12px 0}
.sf-toggle p{margin:0 0 10px;color:#334155}
.sf-trust-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:14px}
.sf-trust-item{padding:14px 15px;border-radius:14px;background:#fff;border:1px solid #d9e4f0;color:#0f172a}
.sf-trust-item strong{display:block;margin-bottom:6px}
.sf-value-list{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:8px}
.sf-value-list li{padding-left:16px;position:relative;color:#334155}
.sf-value-list li:before{content:"";position:absolute;left:0;top:.6em;width:7px;height:7px;border-radius:999px;background:#22d3ee}
.sf-hero-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:24px;align-items:center}
.sf-visual-frame{border:1px solid #d9e4f0;background:linear-gradient(165deg,#ffffff,#eaf1f8);border-radius:20px;min-height:230px;display:flex;align-items:center;justify-content:center;padding:18px}
.sf-visual-frame p{margin:0;color:#0f172a;font-weight:600;text-align:center;line-height:1.35}
.sf-cta-band h2{max-width:20ch}
.sf-cta-band .sf-lede{max-width:52ch}
@media (max-width:800px){
  .sf-wrap{padding:8px 0 26px}
  .sf-section{padding:42px 18px;border-radius:22px}
  .sf-space-spacious{padding-top:52px;padding-bottom:52px}
  .sf-hero-grid{grid-template-columns:1fr}
  .sf-btn-row{flex-direction:column;align-items:stretch}
  .sf-btn{width:100%;text-align:center}
}
</style>`;
}

export function sectionHtml(
  title: string,
  body: string,
  cta?: string,
  options?: {
    sectionType?: string | null;
    visualPattern?: string | null;
    sectionBandStyle?: string | null;
    heroLayoutVariant?: string | null;
    heroVisualStrategy?: string | null;
    sectionSpacingProfile?: string | null;
    typographyHierarchyProfile?: string | null;
    ctaRhythmProfile?: string | null;
    trustRenderStrategy?: string | null;
    mockupRenderStrategy?: string | null;
    mobileStackStrategy?: string | null;
    sectionTransitionStrategy?: string | null;
  }
): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const pattern = options?.visualPattern ?? "";
  const spacingProfile = options?.sectionSpacingProfile ?? "";
  const band = options?.sectionBandStyle === "accent" ? "sf-band-accent" : options?.sectionBandStyle === "dark" ? "sf-band-contrast" : "sf-band-muted";
  const transitionClass =
    options?.sectionTransitionStrategy?.includes("accent") || options?.sectionTransitionStrategy?.includes("hero")
      ? "sf-transition-accent"
      : "sf-transition-calm";
  const spacingClass = spacingProfile.includes("compact") ? "sf-space-compact" : spacingProfile.includes("comfortable") ? "sf-space-comfortable" : "sf-space-spacious";
  const points = safeBullets(linesFromBody(body), 6);
  const lead = escapeHtml(points[0] ?? body);
  const valuePoints = safeBullets(points.slice(1), 4);
  const ctaRow = cta
    ? `<div class="sf-btn-row">${safeButton(cta, "primary")}${safeButton("See details", "secondary")}</div>`
    : "";

  if (pattern === "feature_cards_grid" || pattern === "icon_benefits_row" || pattern === "testimonial_cards") {
    const cards = (points.length ? points : [body])
      .slice(0, 6)
      .map((entry) => `<article class="sf-card"><h3>${safeTitle}</h3><p class="sf-lede">${escapeHtml(entry)}</p></article>`)
      .join("");
    return `<section class="sf-section ${spacingClass} ${band} ${transitionClass}"><p class="sf-kicker">Highlights</p><h2>${safeTitle}</h2><div class="sf-grid sf-grid-3">${cards}</div>${ctaRow}</section>`;
  }

  if (pattern === "faq_toggle") {
    const faqItems = (points.length ? points : [body]).slice(0, 5);
    const toggles = faqItems
      .map((entry, idx) => {
        const [q, a] = entry.includes("?") ? [entry, body] : [`Question ${idx + 1}`, entry];
        return `<details class="sf-toggle"><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`;
      })
      .join("");
    return `<section class="sf-section sf-space-comfortable sf-band-muted ${transitionClass}"><p class="sf-kicker">FAQ</p><h2>${safeTitle}</h2>${toggles}${ctaRow}</section>`;
  }

  if (pattern === "cta_band") {
    return `<section class="sf-section sf-space-comfortable sf-band-accent sf-cta-band sf-transition-accent"><p class="sf-kicker">Next Step</p><h2>${safeTitle}</h2><p class="sf-lede">${safeBody}</p><div class="sf-btn-row">${safeButton(cta || "Get Started", "primary")}${safeButton("Talk to us", "secondary")}</div></section>`;
  }

  if (pattern === "app_mockup_showcase" || pattern === "hero_split" || pattern === "hero_centered") {
    const mockupLabel = options?.mockupRenderStrategy?.includes("framed_ui")
      ? "Product workflow snapshot"
      : options?.heroVisualStrategy?.includes("service")
        ? "Outcome and process snapshot"
        : "Visual value snapshot";
    const valueStack = valuePoints.length
      ? `<ul class="sf-value-list">${valuePoints.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
      : "";
    const kicker = options?.sectionType === "hero" ? "Hero" : "Overview";
    return `<section class="sf-section sf-space-spacious ${band} sf-transition-accent"><div class="sf-hero-grid"><div><p class="sf-kicker">${kicker}</p><h2>${safeTitle}</h2><p class="sf-lede">${lead}</p>${valueStack}${ctaRow}</div><div class="sf-visual-frame"><p>${escapeHtml(mockupLabel)}</p></div></div></section>`;
  }

  if (pattern === "trust_strip") {
    const assurance = (points.length ? points : ["Clear process ownership", "Transparent implementation steps", "Responsible support coverage"])
      .slice(0, 5)
      .map((entry) => `<article class="sf-trust-item"><strong>Assurance</strong><span>${escapeHtml(entry)}</span></article>`)
      .join("");
    return `<section class="sf-section sf-space-comfortable sf-band-muted ${transitionClass}"><p class="sf-kicker">Trust</p><h2>${safeTitle}</h2><div class="sf-trust-grid">${assurance}</div>${ctaRow}</section>`;
  }

  return `<section class="sf-section ${spacingClass} ${band} ${transitionClass}"><h2>${safeTitle}</h2><p class="sf-lede">${lead}</p>${points.length > 1 ? `<p class="sf-body">${escapeHtml(points.slice(1).join(" "))}</p>` : ""}${ctaRow}</section>`;
}
