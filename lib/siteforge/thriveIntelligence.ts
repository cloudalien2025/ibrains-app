import { ConnectionProfile, ThriveIntelligence, ThriveSymbolRole, ThriveSymbolIntelligence } from "@/lib/siteforge/contracts";
import { nowIso } from "@/lib/siteforge/utils";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function authHeaders(connection: ConnectionProfile): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (connection.appPassword) {
    const token = Buffer.from(`${connection.username}:${connection.appPassword}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

function titleFromUnknown(rawTitle: unknown, fallback: string): string {
  if (typeof rawTitle === "string" && rawTitle.trim()) return rawTitle.trim();
  if (rawTitle && typeof rawTitle === "object" && !Array.isArray(rawTitle)) {
    const rec = rawTitle as Record<string, unknown>;
    if (typeof rec.raw === "string" && rec.raw.trim()) return rec.raw.trim();
    if (typeof rec.rendered === "string" && rec.rendered.trim()) return rec.rendered.trim();
  }
  return fallback;
}

function inferRoleFromToken(token: string): ThriveSymbolRole {
  const normalized = token.toLowerCase();
  if (normalized.includes("header")) return "header";
  if (normalized.includes("footer")) return "footer";
  if (normalized.includes("section")) return "section";
  return "unknown";
}

export function inferThriveSymbolRole(params: {
  taxonomySlug: string | null;
  title: string;
  slug: string;
}): ThriveSymbolRole {
  const taxRole = params.taxonomySlug ? inferRoleFromToken(params.taxonomySlug) : "unknown";
  if (taxRole !== "unknown") return taxRole;
  const titleRole = inferRoleFromToken(params.title);
  if (titleRole !== "unknown") return titleRole;
  return inferRoleFromToken(params.slug);
}

async function readJsonArray(response: Response): Promise<Record<string, unknown>[]> {
  try {
    const parsed = (await response.json()) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
  } catch {
    return [];
  }
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await response.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function countPostType(params: {
  baseUrl: string;
  headers: HeadersInit;
  endpoint: string;
}): Promise<number | null> {
  const res = await fetch(`${params.baseUrl}/wp-json/wp/v2/${params.endpoint}?per_page=1&context=edit`, {
    headers: params.headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const fromHeader = Number(res.headers.get("x-wp-total"));
  if (Number.isFinite(fromHeader) && fromHeader >= 0) return fromHeader;
  const rows = await readJsonArray(res);
  return rows.length;
}

function toSymbolIntelligence(entry: Record<string, unknown>): ThriveSymbolIntelligence | null {
  const id = entry.id;
  if (typeof id !== "number") return null;
  const slug = typeof entry.slug === "string" ? entry.slug : `symbol-${id}`;
  const title = titleFromUnknown(entry.title, slug);
  const tax = Array.isArray(entry.tcb_symbols_tax) && entry.tcb_symbols_tax.length > 0 ? entry.tcb_symbols_tax[0] : null;
  const taxObj = tax && typeof tax === "object" ? (tax as Record<string, unknown>) : null;
  const taxonomySlug = typeof taxObj?.slug === "string" ? taxObj.slug : null;
  const taxonomyName = typeof taxObj?.name === "string" ? taxObj.name : null;
  const inferredRole = inferThriveSymbolRole({
    taxonomySlug,
    title,
    slug,
  });
  const tveUpdatedPost = typeof entry.tve_updated_post === "string" ? entry.tve_updated_post : "";
  const tveCustomCss = typeof entry.tve_custom_css === "string" ? entry.tve_custom_css : "";

  return {
    id,
    title,
    slug,
    taxonomy: {
      slug: taxonomySlug,
      name: taxonomyName,
    },
    inferredRole,
    reusable: true,
    hasBuilderContent: tveUpdatedPost.trim().length > 0,
    hasCustomCss: tveCustomCss.trim().length > 0,
  };
}

export async function discoverThriveIntelligence(connection: ConnectionProfile): Promise<ThriveIntelligence | null> {
  if (!connection.baseUrl || !connection.username || !connection.appPassword) return null;

  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);
  const warnings: string[] = [];

  let activeSkin: ThriveIntelligence["activeSkin"] = null;
  let symbolInventory: ThriveSymbolIntelligence[] = [];
  let frontPageUsesWpSettings = false;

  try {
    const settingsRes = await fetch(`${baseUrl}/wp-json/wp/v2/settings`, { headers, cache: "no-store" });
    if (settingsRes.ok) {
      const settings = await readJsonRecord(settingsRes);
      const showOnFront = settings?.show_on_front;
      const pageOnFront = settings?.page_on_front;
      const hasFrontPageId = typeof pageOnFront === "number" || (typeof pageOnFront === "string" && pageOnFront.trim());
      frontPageUsesWpSettings = showOnFront === "page" && Boolean(hasFrontPageId);
    } else {
      warnings.push(`settings_unavailable:${settingsRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`settings_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const skinRes = await fetch(`${baseUrl}/wp-json/wp/v2/thrive_skin_tax?per_page=100&context=edit`, {
      headers,
      cache: "no-store",
    });
    if (skinRes.ok) {
      const skins = await readJsonArray(skinRes);
      const foundActive = skins.find((entry) => entry.is_active === "1" || entry.is_active === 1 || entry.is_active === true);
      const selected = foundActive ?? skins[0] ?? null;
      if (selected) {
        activeSkin = {
          id: typeof selected.id === "number" ? selected.id : 0,
          name: typeof selected.name === "string" ? selected.name : "Unknown Skin",
          slug: typeof selected.slug === "string" ? selected.slug : "unknown-skin",
          tag: typeof selected.tag === "string" ? selected.tag : null,
        };
      }
    } else {
      warnings.push(`thrive_skin_tax_unavailable:${skinRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`thrive_skin_tax_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const symbolRes = await fetch(`${baseUrl}/wp-json/wp/v2/tcb_symbol?per_page=100&context=edit`, {
      headers,
      cache: "no-store",
    });
    if (symbolRes.ok) {
      symbolInventory = (await readJsonArray(symbolRes)).map(toSymbolIntelligence).filter((entry): entry is ThriveSymbolIntelligence => Boolean(entry));
    } else {
      warnings.push(`tcb_symbol_unavailable:${symbolRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`tcb_symbol_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  const [thriveTemplateCount, thriveLayoutCount, thriveSectionCount] = await Promise.all([
    countPostType({ baseUrl, headers, endpoint: "thrive_template" }).catch(() => null),
    countPostType({ baseUrl, headers, endpoint: "thrive_layout" }).catch(() => null),
    countPostType({ baseUrl, headers, endpoint: "thrive_section" }).catch(() => null),
  ]);

  const summary = {
    total: symbolInventory.length,
    headers: symbolInventory.filter((entry) => entry.inferredRole === "header").length,
    footers: symbolInventory.filter((entry) => entry.inferredRole === "footer").length,
    sections: symbolInventory.filter((entry) => entry.inferredRole === "section").length,
    unknown: symbolInventory.filter((entry) => entry.inferredRole === "unknown").length,
  };

  return {
    source: "wordpress_rest_get",
    collectedAt: nowIso(),
    mode: "wp_safe_mode",
    activeSkin,
    symbolInventory,
    symbolSummary: summary,
    primitiveCounts: {
      thriveTemplate: thriveTemplateCount ?? 0,
      thriveLayout: thriveLayoutCount ?? 0,
      thriveSection: thriveSectionCount ?? 0,
      tcbSymbol: symbolInventory.length,
    },
    safeHints: {
      frontPageUsesWpSettings,
    },
    warnings,
  };
}
