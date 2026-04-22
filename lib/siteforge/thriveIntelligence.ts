import { ConnectionProfile, ThriveIntelligence, ThriveSymbolRole, ThriveSymbolIntelligence } from "@/lib/siteforge/contracts";
import { nowIso } from "@/lib/siteforge/utils";
import { createHash } from "node:crypto";

const SAFE_THRIVE_READ_PREFIXES = [
  "/wp-json/wp/v2/settings",
  "/wp-json/wp/v2/pages/",
  "/wp-json/wp/v2/thrive_template",
  "/wp-json/wp/v2/thrive_layout",
  "/wp-json/wp/v2/thrive_section",
  "/wp-json/wp/v2/tcb_symbol",
  "/wp-json/wp/v2/thrive_skin_tax",
] as const;

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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function stableHash(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function toUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function assertSafeThriveReadRequest(path: string, method: string): { ok: boolean; reason?: string } {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod !== "GET") {
    return { ok: false, reason: `method_not_allowed:${normalizedMethod}` };
  }

  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/wp-json/ttb/v1/") || lowerPath.includes("/wp-json/tcb/v1/") || lowerPath.includes("/wp-json/td/v1/api-tokens/generate")) {
    return { ok: false, reason: "explicitly_blocked_thrive_route" };
  }

  const isRootIndex = lowerPath === "/wp-json/" || lowerPath === "/wp-json";
  if (!isRootIndex && !SAFE_THRIVE_READ_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))) {
    return { ok: false, reason: `path_not_allowlisted:${path}` };
  }

  return { ok: true };
}

async function safeGet(params: {
  baseUrl: string;
  connection: ConnectionProfile;
  path: string;
}): Promise<Response> {
  const safety = assertSafeThriveReadRequest(params.path, "GET");
  if (!safety.ok) {
    throw new Error(`unsafe_thrive_read_blocked:${safety.reason ?? "unknown"}`);
  }

  return fetch(toUrl(params.baseUrl, params.path), {
    method: "GET",
    headers: authHeaders(params.connection),
    cache: "no-store",
  });
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

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function readPostTypeInventory(params: {
  baseUrl: string;
  connection: ConnectionProfile;
  endpoint: "thrive_template" | "thrive_layout" | "thrive_section";
}): Promise<{ items: Array<{ id: number; slug: string; title: string }>; total: number }> {
  const res = await safeGet({
    baseUrl: params.baseUrl,
    connection: params.connection,
    path: `/wp-json/wp/v2/${params.endpoint}?per_page=100&context=edit`,
  });
  if (!res.ok) return { items: [], total: 0 };

  const fromHeader = Number(res.headers.get("x-wp-total"));
  const items = (await readJsonArray(res))
    .map((entry) => {
      const id = toInt(entry.id);
      if (id == null) return null;
      const slug = typeof entry.slug === "string" ? entry.slug : `${params.endpoint}-${id}`;
      const title = titleFromUnknown(entry.title, slug);
      return { id, slug, title };
    })
    .filter((entry): entry is { id: number; slug: string; title: string } => Boolean(entry));
  return {
    items,
    total: Number.isFinite(fromHeader) && fromHeader >= 0 ? fromHeader : items.length,
  };
}

function toSymbolIntelligence(entry: Record<string, unknown>): ThriveSymbolIntelligence | null {
  const id = toInt(entry.id);
  if (id == null) return null;
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
  const tokenSource = [title, slug, taxonomySlug ?? "", taxonomyName ?? ""].join(" ");

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
    contentHash: stableHash(tveUpdatedPost),
    cssHash: stableHash(tveCustomCss),
    keywords: tokenize(tokenSource),
  };
}

export async function discoverThriveIntelligence(connection: ConnectionProfile): Promise<ThriveIntelligence | null> {
  if (!connection.baseUrl || !connection.username || !connection.appPassword) return null;

  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const warnings: string[] = [];
  const namespaces: string[] = [];

  let homepage = {
    showOnFront: "",
    pageOnFront: null as number | null,
    pageForPosts: null as number | null,
  };

  let activeSkin: ThriveIntelligence["activeSkin"] = null;
  let symbolInventory: ThriveSymbolIntelligence[] = [];
  let templates: ThriveIntelligence["templates"] = [];
  let layouts: ThriveIntelligence["layouts"] = [];
  let sections: ThriveIntelligence["sections"] = [];
  let templateTotal = 0;
  let layoutTotal = 0;
  let sectionTotal = 0;
  let frontPageUsesWpSettings = false;

  try {
    const rootRes = await safeGet({ baseUrl, connection, path: "/wp-json/" });
    if (rootRes.ok) {
      const root = await readJsonRecord(rootRes);
      const discovered = root && Array.isArray(root.namespaces) ? root.namespaces.filter((entry): entry is string => typeof entry === "string") : [];
      namespaces.push(...discovered);
    } else {
      warnings.push(`root_index_unavailable:${rootRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`root_index_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const settingsRes = await safeGet({ baseUrl, connection, path: "/wp-json/wp/v2/settings" });
    if (settingsRes.ok) {
      const settings = await readJsonRecord(settingsRes);
      const showOnFront = typeof settings?.show_on_front === "string" ? settings.show_on_front : "";
      const pageOnFront = toInt(settings?.page_on_front);
      const pageForPosts = toInt(settings?.page_for_posts);
      homepage = {
        showOnFront,
        pageOnFront,
        pageForPosts,
      };
      frontPageUsesWpSettings = showOnFront === "page" && pageOnFront != null;
    } else {
      warnings.push(`settings_unavailable:${settingsRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`settings_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const skinRes = await safeGet({
      baseUrl,
      connection,
      path: "/wp-json/wp/v2/thrive_skin_tax?per_page=100&context=edit",
    });
    if (skinRes.ok) {
      const skins = await readJsonArray(skinRes);
      const foundActive = skins.find((entry) => entry.is_active === "1" || entry.is_active === 1 || entry.is_active === true);
      const selected = foundActive ?? skins[0] ?? null;
      if (selected) {
        activeSkin = {
          id: toInt(selected.id) ?? 0,
          name: typeof selected.name === "string" ? selected.name : "Unknown Skin",
          slug: typeof selected.slug === "string" ? selected.slug : "unknown-skin",
          tag: typeof selected.tag === "string" ? selected.tag : null,
          isActive: Boolean(foundActive),
        };
      }
    } else {
      warnings.push(`thrive_skin_tax_unavailable:${skinRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`thrive_skin_tax_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const symbolRes = await safeGet({
      baseUrl,
      connection,
      path: "/wp-json/wp/v2/tcb_symbol?per_page=100&context=edit",
    });
    if (symbolRes.ok) {
      symbolInventory = (await readJsonArray(symbolRes)).map(toSymbolIntelligence).filter((entry): entry is ThriveSymbolIntelligence => Boolean(entry));
    } else {
      warnings.push(`tcb_symbol_unavailable:${symbolRes.status}`);
    }
  } catch (error: unknown) {
    warnings.push(`tcb_symbol_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const [templateInventory, layoutInventory, sectionInventory] = await Promise.all([
      readPostTypeInventory({ baseUrl, connection, endpoint: "thrive_template" }),
      readPostTypeInventory({ baseUrl, connection, endpoint: "thrive_layout" }),
      readPostTypeInventory({ baseUrl, connection, endpoint: "thrive_section" }),
    ]);
    templates = templateInventory.items;
    layouts = layoutInventory.items;
    sections = sectionInventory.items;
    templateTotal = templateInventory.total;
    layoutTotal = layoutInventory.total;
    sectionTotal = sectionInventory.total;
  } catch (error: unknown) {
    warnings.push(`thrive_inventory_exception:${error instanceof Error ? error.message : "unknown"}`);
  }

  const summary = {
    total: symbolInventory.length,
    headers: symbolInventory.filter((entry) => entry.inferredRole === "header").length,
    footers: symbolInventory.filter((entry) => entry.inferredRole === "footer").length,
    sections: symbolInventory.filter((entry) => entry.inferredRole === "section").length,
    unknown: symbolInventory.filter((entry) => entry.inferredRole === "unknown").length,
  };

  const hasNamespace = (needle: string) => namespaces.some((entry) => entry.toLowerCase().startsWith(needle));

  return {
    storageMode: "wordpress-rest-readonly",
    namespaces: Array.from(new Set(namespaces)),
    source: "wordpress_rest_get",
    collectedAt: nowIso(),
    mode: "wp_safe_mode",
    homepage,
    activeSkin,
    templates,
    layouts,
    sections,
    symbolInventory,
    symbolSummary: summary,
    primitiveCounts: {
      thriveTemplate: templateTotal || templates.length,
      thriveLayout: layoutTotal || layouts.length,
      thriveSection: sectionTotal || sections.length,
      tcbSymbol: symbolInventory.length,
    },
    safeHints: {
      frontPageUsesWpSettings,
    },
    discoveredCapabilities: {
      hasTtbNamespace: hasNamespace("ttb/"),
      hasTcbNamespace: hasNamespace("tcb/"),
      hasThemeNamespace: hasNamespace("thrive-theme"),
      hasTdNamespace: hasNamespace("td/"),
      hasTveDashNamespace: hasNamespace("tve-dash"),
      designPackLikelyAvailable: hasNamespace("ttb/") || hasNamespace("tve-dash"),
    },
    warnings,
  };
}
