import {
  BuildSpec,
  CapabilityCheckResult,
  ConnectionProfile,
  ExecutionActionLog,
  ExecutionPageRecord,
  ExecutionResult,
  HomepageStrategyMode,
  PageIntent,
} from "@/lib/siteforge/contracts";
import { sectionHtml, siteforgeVisualStyles } from "@/lib/siteforge/utils";

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  title?: { rendered?: string } | string;
};

type ExistingWordPressPage = {
  id: number;
  slug: string;
  title: string;
  status: string;
  url: string | null;
};

type SiteDiscovery = {
  source: "wordpress";
  frontPageId: number | null;
  frontPageTitle: string | null;
  pages: ExistingWordPressPage[];
};

type PageDecision = {
  page: BuildSpec["pages"][number];
  intent: PageIntent;
  decision: "reused_existing" | "created_new";
  reason: string;
  target: ExistingWordPressPage | null;
};

const HOMEPAGE_SLUGS = new Set(["home", "homepage", "front-page", "frontpage", "index"]);
const CONTACT_SLUGS = new Set(["contact", "contact-us", "support", "contact-support", "contact-and-support"]);
const ABOUT_SLUGS = new Set(["about", "about-us", "aboutus", "our-story", "company"]);
const FAQ_SLUGS = new Set(["faq", "faqs", "frequently-asked-questions"]);
const FEATURES_SLUGS = new Set(["features", "feature", "capabilities", "what-we-do"]);
const PRICING_SLUGS = new Set(["pricing", "plans", "plan", "price", "prices"]);

function authHeaders(connection: ConnectionProfile): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (connection.appPassword) {
    const token = Buffer.from(`${connection.username}:${connection.appPassword}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

async function safeJsonValue(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  const parsed = await safeJsonValue(response);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

async function safeJsonArray(response: Response): Promise<Record<string, unknown>[]> {
  const parsed = await safeJsonValue(response);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function normalizeToken(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function titleFromWpPayload(rawTitle: unknown, fallback: string): string {
  if (typeof rawTitle === "string" && rawTitle.trim()) {
    return rawTitle.trim();
  }
  if (rawTitle && typeof rawTitle === "object" && !Array.isArray(rawTitle)) {
    const rendered = (rawTitle as { rendered?: unknown }).rendered;
    if (typeof rendered === "string" && rendered.trim()) return rendered.trim();
  }
  return fallback;
}

function classifyPageIntent(page: BuildSpec["pages"][number], homepageSlug: string): PageIntent {
  const slug = normalizeToken(page.slug);
  const title = normalizeText(page.title);

  if (slug === normalizeToken(homepageSlug)) return "homepage";
  if (HOMEPAGE_SLUGS.has(slug) || title === "home" || title === "homepage" || title === "front page") return "homepage";
  if (CONTACT_SLUGS.has(slug) || hasWord(title, "contact") || hasWord(title, "support")) return "contact";
  if (ABOUT_SLUGS.has(slug) || hasWord(title, "about")) return "about";
  if (FAQ_SLUGS.has(slug) || title.includes("faq") || title.includes("frequently asked")) return "faq";
  if (FEATURES_SLUGS.has(slug) || hasWord(title, "features") || hasWord(title, "capabilities")) return "features";
  if (PRICING_SLUGS.has(slug) || hasWord(title, "pricing") || hasWord(title, "plans")) return "pricing";
  return "generic";
}

function scoreMatch(params: {
  intent: PageIntent;
  candidate: ExistingWordPressPage;
  specPage: BuildSpec["pages"][number];
  homepageSlug: string;
  frontPageId: number | null;
}): number {
  const { intent, candidate, specPage, homepageSlug, frontPageId } = params;
  const candidateSlug = normalizeToken(candidate.slug);
  const candidateTitle = normalizeText(candidate.title);
  const specSlug = normalizeToken(specPage.slug);
  const specTitle = normalizeText(specPage.title);
  let score = 0;

  if (candidateSlug === specSlug) score += 100;
  if (candidateTitle && candidateTitle === specTitle) score += 70;

  if (intent === "homepage") {
    if (frontPageId && candidate.id === frontPageId) score += 250;
    if (candidateSlug === normalizeToken(homepageSlug)) score += 120;
    if (HOMEPAGE_SLUGS.has(candidateSlug)) score += 100;
    if (candidateTitle === "home" || candidateTitle === "homepage" || candidateTitle === "front page") score += 90;
  }

  if (intent === "contact") {
    if (CONTACT_SLUGS.has(candidateSlug)) score += 110;
    if (hasWord(candidateTitle, "contact")) score += 85;
    if (hasWord(candidateTitle, "support")) score += 35;
  }

  if (intent === "about") {
    if (ABOUT_SLUGS.has(candidateSlug)) score += 110;
    if (hasWord(candidateTitle, "about")) score += 90;
  }

  if (intent === "faq") {
    if (FAQ_SLUGS.has(candidateSlug)) score += 120;
    if (candidateTitle.includes("faq") || candidateTitle.includes("frequently asked")) score += 90;
  }

  if (intent === "features") {
    if (FEATURES_SLUGS.has(candidateSlug)) score += 120;
    if (hasWord(candidateTitle, "features") || hasWord(candidateTitle, "capabilities")) score += 90;
  }

  if (intent === "pricing") {
    if (PRICING_SLUGS.has(candidateSlug)) score += 120;
    if (hasWord(candidateTitle, "pricing") || hasWord(candidateTitle, "plans")) score += 90;
  }

  return score;
}

function thresholdForIntent(intent: PageIntent): number {
  if (intent === "homepage") return 90;
  if (intent === "contact") return 85;
  if (intent === "about") return 85;
  if (intent === "faq" || intent === "features" || intent === "pricing") return 90;
  return 100;
}

function bestMatch(params: {
  intent: PageIntent;
  specPage: BuildSpec["pages"][number];
  pages: ExistingWordPressPage[];
  homepageSlug: string;
  frontPageId: number | null;
}): { match: ExistingWordPressPage | null; score: number } {
  let top: ExistingWordPressPage | null = null;
  let topScore = 0;

  for (const candidate of params.pages) {
    const score = scoreMatch({
      intent: params.intent,
      candidate,
      specPage: params.specPage,
      homepageSlug: params.homepageSlug,
      frontPageId: params.frontPageId,
    });
    if (!top || score > topScore || (score === topScore && candidate.id < top.id)) {
      top = candidate;
      topScore = score;
    }
  }

  return { match: top, score: topScore };
}

function reconcilePages(params: {
  spec: BuildSpec;
  discovery: SiteDiscovery;
  homepageStrategy: HomepageStrategyMode;
  actionLog: ExecutionActionLog[];
}): PageDecision[] {
  const { spec, discovery, homepageStrategy, actionLog } = params;
  const decisions: PageDecision[] = [];
  const claimedTargetIds = new Set<number>();

  for (const page of spec.pages) {
    const intent = classifyPageIntent(page, spec.homepageSlug);

    if (intent === "homepage") {
      const frontPage = discovery.frontPageId
        ? discovery.pages.find((entry) => entry.id === discovery.frontPageId) ?? null
        : null;

      if (homepageStrategy === "use_existing" || homepageStrategy === "replace_existing") {
        if (frontPage) {
          decisions.push({
            page,
            intent,
            decision: "reused_existing",
            reason: `homepage_strategy_${homepageStrategy}:front_page_setting`,
            target: frontPage,
          });
          claimedTargetIds.add(frontPage.id);
          continue;
        }

        const fallback = bestMatch({
          intent,
          specPage: page,
          pages: discovery.pages,
          homepageSlug: spec.homepageSlug,
          frontPageId: discovery.frontPageId,
        });

        if (fallback.match && fallback.score >= thresholdForIntent(intent)) {
          decisions.push({
            page,
            intent,
            decision: "reused_existing",
            reason: `homepage_strategy_${homepageStrategy}:fallback_home_match`,
            target: fallback.match,
          });
          claimedTargetIds.add(fallback.match.id);
          continue;
        }
      }

      if (homepageStrategy === "create_new") {
        const collision = bestMatch({
          intent,
          specPage: page,
          pages: discovery.pages,
          homepageSlug: spec.homepageSlug,
          frontPageId: discovery.frontPageId,
        });

        if (collision.match && collision.score >= thresholdForIntent(intent)) {
          decisions.push({
            page,
            intent,
            decision: "reused_existing",
            reason: "homepage_strategy_create_new:collision_avoidance_reuse",
            target: collision.match,
          });
          claimedTargetIds.add(collision.match.id);
          continue;
        }
      }

      decisions.push({
        page,
        intent,
        decision: "created_new",
        reason: `homepage_strategy_${homepageStrategy}:create_new_homepage`,
        target: null,
      });
      continue;
    }

    const candidate = bestMatch({
      intent,
      specPage: page,
      pages: discovery.pages,
      homepageSlug: spec.homepageSlug,
      frontPageId: discovery.frontPageId,
    });

    if (candidate.match && candidate.score >= thresholdForIntent(intent) && !claimedTargetIds.has(candidate.match.id)) {
      decisions.push({
        page,
        intent,
        decision: "reused_existing",
        reason: `${intent}_intent_match(score=${candidate.score})`,
        target: candidate.match,
      });
      claimedTargetIds.add(candidate.match.id);
      continue;
    }

    decisions.push({
      page,
      intent,
      decision: "created_new",
      reason: candidate.match
        ? `${intent}_intent_match_below_threshold(score=${candidate.score})`
        : `${intent}_intent_no_match`,
      target: null,
    });
  }

  for (const decision of decisions) {
    actionLog.push({
      at: new Date().toISOString(),
      action: "reconcile_page_target",
      success: true,
      detail: `${decision.page.slug} -> ${decision.decision}`,
      payload: {
        slug: decision.page.slug,
        intent: decision.intent,
        decision: decision.decision,
        reason: decision.reason,
        targetPageId: decision.target?.id ?? null,
      },
    });
  }

  return decisions;
}

export async function validateWordPressConnection(
  connection: ConnectionProfile
): Promise<CapabilityCheckResult> {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);

  try {
    const apiRes = await fetch(`${baseUrl}/wp-json`, { headers, cache: "no-store" });
    const apiJson = await safeJson(apiRes);
    if (!apiRes.ok || !apiJson) {
      return {
        connected: false,
        canWritePages: false,
        canManageSettings: false,
        thriveDetected: false,
        thriveSignals: [],
        message: "Unable to reach WordPress REST API endpoint.",
      };
    }

    const usersRes = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, { headers, cache: "no-store" });
    const canWritePages = usersRes.ok;

    const settingsRes = await fetch(`${baseUrl}/wp-json/wp/v2/settings`, { headers, cache: "no-store" });
    const canManageSettings = settingsRes.ok;

    const namespaces = Array.isArray(apiJson.namespaces)
      ? apiJson.namespaces.filter((entry): entry is string => typeof entry === "string")
      : [];

    const thriveSignals = namespaces.filter((namespace) => /thrive|tve/i.test(namespace));
    const thriveDetected = thriveSignals.length > 0 || connection.hasThriveHint === true;

    return {
      connected: true,
      canWritePages,
      canManageSettings,
      thriveDetected,
      thriveSignals,
      message: canWritePages
        ? "Connection validated. WordPress API access is available."
        : "Connected to WordPress, but credentials cannot create pages.",
    };
  } catch (error: unknown) {
    return {
      connected: false,
      canWritePages: false,
      canManageSettings: false,
      thriveDetected: false,
      thriveSignals: [],
      message: error instanceof Error ? error.message : "Unknown WordPress connection error.",
    };
  }
}

async function discoverExistingSite(
  connection: ConnectionProfile,
  actionLog: ExecutionActionLog[],
  warnings: string[]
): Promise<SiteDiscovery> {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);

  let frontPageId: number | null = null;
  let frontPageTitle: string | null = null;

  try {
    const settingsRes = await fetch(`${baseUrl}/wp-json/wp/v2/settings`, {
      headers,
      cache: "no-store",
    });

    if (settingsRes.ok) {
      const settings = await safeJson(settingsRes);
      const value = settings?.page_on_front;
      if (typeof value === "number") {
        frontPageId = value;
      } else if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        frontPageId = Number.isFinite(parsed) ? parsed : null;
      }
    } else {
      warnings.push(`Unable to fetch WordPress settings for front page detection (HTTP ${settingsRes.status}).`);
    }
  } catch (error: unknown) {
    warnings.push(
      `Front page detection failed: ${error instanceof Error ? error.message : "unknown settings error"}.`
    );
  }

  const pages: ExistingWordPressPage[] = [];
  const perPage = 100;

  for (let pageNo = 1; pageNo <= 10; pageNo += 1) {
    const url = `${baseUrl}/wp-json/wp/v2/pages?per_page=${perPage}&page=${pageNo}&status=publish,draft,pending,private,future&_fields=id,slug,status,link,title`;

    try {
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        if (pageNo === 1) {
          warnings.push(`Unable to list existing pages for reconciliation (HTTP ${res.status}).`);
        }
        break;
      }

      const payload = await safeJsonArray(res);
      const mapped = payload
        .map((entry) => {
          const raw = entry as {
            id?: unknown;
            slug?: unknown;
            link?: unknown;
            status?: unknown;
            title?: unknown;
          };

          if (typeof raw.id !== "number") return null;
          const slug = typeof raw.slug === "string" ? raw.slug : "";
          const status = typeof raw.status === "string" ? raw.status : "unknown";
          const title = titleFromWpPayload(raw.title, slug || `Page ${raw.id}`);

          return {
            id: raw.id,
            slug,
            status,
            title,
            url: typeof raw.link === "string" ? raw.link : null,
          } satisfies ExistingWordPressPage;
        })
        .filter((entry): entry is ExistingWordPressPage => Boolean(entry));

      pages.push(...mapped);
      if (mapped.length < perPage) break;
    } catch (error: unknown) {
      warnings.push(`Page inventory discovery failed on page ${pageNo}: ${error instanceof Error ? error.message : "unknown"}.`);
      break;
    }
  }

  if (frontPageId) {
    const front = pages.find((entry) => entry.id === frontPageId);
    if (front) {
      frontPageTitle = front.title;
    }
  }

  actionLog.push({
    at: new Date().toISOString(),
    action: "discover_existing_site",
    success: true,
    detail: `Discovered ${pages.length} pages`,
    payload: {
      frontPageId,
      pages: pages.length,
    },
  });

  return {
    source: "wordpress",
    frontPageId,
    frontPageTitle,
    pages,
  };
}

function pageContentHtml(page: BuildSpec["pages"][number]): string {
  const intro = `<div class="sf-wrap"><h1>${page.title}</h1><p>${page.purpose}</p>`;
  const sections = page.sections
    .map((section) =>
      sectionHtml(section.heading, section.body, section.cta, {
        visualPattern: section.metadata?.visualComposition?.visualPattern ?? null,
        sectionBandStyle: section.metadata?.visualComposition?.sectionBandStyle ?? null,
      })
    )
    .join("\n");
  return `${siteforgeVisualStyles()}\n${intro}\n${sections}\n</div>`;
}

async function createPage(
  connection: ConnectionProfile,
  page: BuildSpec["pages"][number],
  actionLog: ExecutionActionLog[],
  intent: PageIntent,
  decisionReason: string
): Promise<ExecutionPageRecord> {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);

  try {
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/pages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: page.title,
        slug: page.slug,
        content: pageContentHtml(page),
        status: "draft",
      }),
    });

    const payload = (await safeJson(res)) as WordPressPage | null;
    const success = res.ok && typeof payload?.id === "number";

    actionLog.push({
      at: new Date().toISOString(),
      action: "create_page",
      success,
      detail: success ? `Created page ${page.slug}` : `Failed page ${page.slug}`,
      payload: {
        slug: page.slug,
        status: res.status,
        intent,
      },
    });

    if (!success) {
      return {
        title: page.title,
        slug: page.slug,
        pageId: null,
        url: null,
        status: "failed",
        error: `HTTP ${res.status}`,
        intent,
        decision: "created_new",
        decisionReason,
        matchedPage: null,
      };
    }

    return {
      title: page.title,
      slug: page.slug,
      pageId: payload.id,
      url: payload.link ?? null,
      status: "created",
      intent,
      decision: "created_new",
      decisionReason,
      matchedPage: null,
    };
  } catch (error: unknown) {
    actionLog.push({
      at: new Date().toISOString(),
      action: "create_page",
      success: false,
      detail: `Exception while creating ${page.slug}`,
      payload: { message: error instanceof Error ? error.message : "unknown", intent },
    });

    return {
      title: page.title,
      slug: page.slug,
      pageId: null,
      url: null,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown exception",
      intent,
      decision: "created_new",
      decisionReason,
      matchedPage: null,
    };
  }
}

async function updatePage(
  connection: ConnectionProfile,
  target: ExistingWordPressPage,
  page: BuildSpec["pages"][number],
  actionLog: ExecutionActionLog[],
  intent: PageIntent,
  decisionReason: string
): Promise<ExecutionPageRecord> {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);

  try {
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/pages/${target.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: page.title,
        content: pageContentHtml(page),
      }),
    });

    const payload = (await safeJson(res)) as WordPressPage | null;
    const success = res.ok;

    actionLog.push({
      at: new Date().toISOString(),
      action: "update_page",
      success,
      detail: success ? `Updated existing page ${target.slug}` : `Failed update ${target.slug}`,
      payload: {
        slug: page.slug,
        targetId: target.id,
        status: res.status,
        intent,
      },
    });

    if (!success) {
      return {
        title: page.title,
        slug: page.slug,
        pageId: target.id,
        url: target.url,
        status: "failed",
        error: `HTTP ${res.status}`,
        intent,
        decision: "reused_existing",
        decisionReason,
        matchedPage: {
          id: target.id,
          slug: target.slug,
          title: target.title,
          status: target.status,
        },
      };
    }

    return {
      title: page.title,
      slug: page.slug,
      pageId: target.id,
      url: payload?.link ?? target.url,
      status: "updated",
      intent,
      decision: "reused_existing",
      decisionReason,
      matchedPage: {
        id: target.id,
        slug: target.slug,
        title: target.title,
        status: target.status,
      },
    };
  } catch (error: unknown) {
    actionLog.push({
      at: new Date().toISOString(),
      action: "update_page",
      success: false,
      detail: `Exception while updating ${target.slug}`,
      payload: { message: error instanceof Error ? error.message : "unknown", intent },
    });

    return {
      title: page.title,
      slug: page.slug,
      pageId: target.id,
      url: target.url,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown exception",
      intent,
      decision: "reused_existing",
      decisionReason,
      matchedPage: {
        id: target.id,
        slug: target.slug,
        title: target.title,
        status: target.status,
      },
    };
  }
}

async function assignHomepageViaSettings(
  connection: ConnectionProfile,
  homepageId: number | null,
  actionLog: ExecutionActionLog[]
): Promise<ExecutionResult["homepage"]> {
  if (!homepageId) {
    return {
      success: false,
      pageId: null,
      message: "Homepage page ID missing; could not assign front page.",
      reason: "missing_homepage_target",
    };
  }

  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);

  try {
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/settings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        show_on_front: "page",
        page_on_front: homepageId,
      }),
    });

    const success = res.ok;
    actionLog.push({
      at: new Date().toISOString(),
      action: "assign_homepage",
      success,
      detail: success ? "Homepage assigned" : "Homepage assignment failed",
      payload: { status: res.status, pageId: homepageId },
    });

    return {
      success,
      pageId: homepageId,
      message: success
        ? "Homepage assigned successfully."
        : "Could not assign homepage via settings API. Permission may be limited.",
      reason: success ? "settings_updated" : "settings_update_failed",
    };
  } catch (error: unknown) {
    return {
      success: false,
      pageId: homepageId,
      message: error instanceof Error ? error.message : "Unknown homepage assignment error.",
      reason: "settings_update_exception",
    };
  }
}

async function createMenu(
  connection: ConnectionProfile,
  pageRecords: ExecutionPageRecord[],
  actionLog: ExecutionActionLog[]
): Promise<ExecutionResult["menu"]> {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const headers = authHeaders(connection);

  const availablePages = pageRecords
    .filter((record) => record.pageId != null && (record.status === "created" || record.status === "updated"))
    .filter((record, index, list) => list.findIndex((entry) => entry.pageId === record.pageId) === index);

  if (!availablePages.length) {
    return { success: false, menuId: null, message: "No created or reused pages available for menu setup." };
  }

  try {
    const menuRes = await fetch(`${baseUrl}/wp-json/wp/v2/menus`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Primary Navigation" }),
    });

    const menuPayload = await safeJson(menuRes);
    const menuId = typeof menuPayload?.id === "number" ? menuPayload.id : null;

    if (!menuRes.ok || !menuId) {
      actionLog.push({
        at: new Date().toISOString(),
        action: "create_menu",
        success: false,
        detail: "WordPress menu API unavailable. Skipping menu creation.",
        payload: { status: menuRes.status },
      });
      return {
        success: false,
        menuId: null,
        message: "Menu API unavailable. Pages were updated/created; configure navigation manually if needed.",
      };
    }

    for (const page of availablePages) {
      await fetch(`${baseUrl}/wp-json/wp/v2/menu-items`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          menus: menuId,
          object_id: page.pageId,
          object: "page",
          type: "post_type",
          title: page.title,
          status: "publish",
        }),
      });
    }

    actionLog.push({
      at: new Date().toISOString(),
      action: "create_menu",
      success: true,
      detail: "Primary navigation created",
      payload: { menuId },
    });

    return {
      success: true,
      menuId,
      message: "Menu created and items attached.",
    };
  } catch {
    return {
      success: false,
      menuId: null,
      message: "Menu creation failed; manual nav setup may be required.",
    };
  }
}

export async function executeBuildSpecToWordPress(
  connection: ConnectionProfile,
  spec: BuildSpec,
  thrive: ExecutionResult["thrive"],
  homepageStrategy: HomepageStrategyMode = "use_existing"
): Promise<ExecutionResult> {
  const actionLog: ExecutionActionLog[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const discovery = await discoverExistingSite(connection, actionLog, warnings);
  const decisions = reconcilePages({
    spec,
    discovery,
    homepageStrategy,
    actionLog,
  });

  const pages: ExecutionPageRecord[] = [];
  for (const decision of decisions) {
    const record =
      decision.decision === "reused_existing" && decision.target
        ? await updatePage(connection, decision.target, decision.page, actionLog, decision.intent, decision.reason)
        : await createPage(connection, decision.page, actionLog, decision.intent, decision.reason);
    pages.push(record);
  }

  if (pages.some((page) => page.status === "failed")) {
    warnings.push("One or more pages failed to apply.");
  }

  const homepageRecord = pages.find((page) => page.intent === "homepage") ?? null;
  let homepage: ExecutionResult["homepage"];

  if (
    homepageStrategy === "use_existing" &&
    homepageRecord?.pageId &&
    discovery.frontPageId &&
    homepageRecord.pageId === discovery.frontPageId
  ) {
    homepage = {
      success: true,
      pageId: homepageRecord.pageId,
      title: homepageRecord.title,
      message: "Existing WordPress front page retained as canonical homepage target.",
      reason: "use_existing_front_page_retained",
    };
    actionLog.push({
      at: new Date().toISOString(),
      action: "assign_homepage",
      success: true,
      detail: "Homepage already set to canonical existing front page; no settings update needed.",
      payload: { pageId: homepageRecord.pageId, strategy: homepageStrategy },
    });
  } else if (homepageStrategy === "draft_only") {
    homepage = {
      success: true,
      pageId: homepageRecord?.pageId ?? null,
      title: homepageRecord?.title ?? null,
      message: "Draft-only mode; homepage assignment skipped.",
      reason: "draft_only_skip_assignment",
    };
  } else {
    homepage = await assignHomepageViaSettings(connection, homepageRecord?.pageId ?? null, actionLog);
    homepage.title = homepageRecord?.title ?? null;
  }

  const menu = await createMenu(connection, pages, actionLog);

  if (!homepage.success) warnings.push(homepage.message);
  if (!menu.success) warnings.push(menu.message);

  const success = pages.some((page) => page.status === "created" || page.status === "updated") && errors.length === 0;

  return {
    success,
    createdPages: pages,
    homepage,
    menu,
    thrive,
    actionLog,
    warnings,
    errors,
    discovery,
    reconciliation: {
      homepageStrategy,
      decisions: decisions.map((decision) => ({
        slug: decision.page.slug,
        intent: decision.intent,
        decision: decision.decision,
        targetPageId: decision.target?.id ?? null,
        reason: decision.reason,
      })),
    },
  };
}

export async function executeRevisionToWordPress(
  connection: ConnectionProfile,
  spec: BuildSpec,
  prior: ExecutionResult
): Promise<{ updatedPages: ExecutionPageRecord[]; warnings: string[]; errors: string[]; success: boolean }> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const priorBySlug = new Map(prior.createdPages.map((page) => [page.slug, page]));
  const updatedPages: ExecutionPageRecord[] = [];

  for (const page of spec.pages) {
    const priorPage = priorBySlug.get(page.slug);
    if (!priorPage?.pageId) {
      warnings.push(`No prior WordPress page mapping for slug ${page.slug}; skipped update.`);
      continue;
    }

    const baseUrl = normalizeBaseUrl(connection.baseUrl);
    const headers = authHeaders(connection);

    try {
      const res = await fetch(`${baseUrl}/wp-json/wp/v2/pages/${priorPage.pageId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: page.title,
          content: pageContentHtml(page),
        }),
      });

      if (!res.ok) {
        errors.push(`Failed to update page ${page.slug} (HTTP ${res.status}).`);
        updatedPages.push({ ...priorPage, status: "failed", error: `HTTP ${res.status}` });
        continue;
      }

      const payload = (await safeJson(res)) as WordPressPage | null;
      updatedPages.push({
        title: page.title,
        slug: page.slug,
        pageId: priorPage.pageId,
        url: payload?.link ?? priorPage.url,
        status: "updated",
        intent: priorPage.intent,
        decision: priorPage.decision,
        decisionReason: priorPage.decisionReason,
        matchedPage: priorPage.matchedPage,
      });
    } catch (error: unknown) {
      errors.push(`Exception while updating ${page.slug}: ${error instanceof Error ? error.message : "unknown"}`);
      updatedPages.push({
        title: page.title,
        slug: page.slug,
        pageId: priorPage.pageId,
        url: priorPage.url,
        status: "failed",
        error: error instanceof Error ? error.message : "unknown",
        intent: priorPage.intent,
        decision: priorPage.decision,
        decisionReason: priorPage.decisionReason,
        matchedPage: priorPage.matchedPage,
      });
    }
  }

  return {
    success: errors.length === 0,
    updatedPages,
    warnings,
    errors,
  };
}
