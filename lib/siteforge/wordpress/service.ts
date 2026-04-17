import {
  BuildSpec,
  CapabilityCheckResult,
  ConnectionProfile,
  ExecutionActionLog,
  ExecutionPageRecord,
  ExecutionResult,
} from "@/lib/siteforge/contracts";
import { sectionHtml } from "@/lib/siteforge/utils";

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
};

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

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await response.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
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

function pageContentHtml(page: BuildSpec["pages"][number]): string {
  const intro = `<h1>${page.title}</h1><p>${page.purpose}</p>`;
  const sections = page.sections.map((section) => sectionHtml(section.heading, section.body, section.cta)).join("\n");
  return `${intro}\n${sections}`;
}

async function createPage(
  connection: ConnectionProfile,
  page: BuildSpec["pages"][number],
  actionLog: ExecutionActionLog[]
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
      };
    }

    return {
      title: page.title,
      slug: page.slug,
      pageId: payload.id,
      url: payload.link ?? null,
      status: "created",
    };
  } catch (error: unknown) {
    actionLog.push({
      at: new Date().toISOString(),
      action: "create_page",
      success: false,
      detail: `Exception while creating ${page.slug}`,
      payload: { message: error instanceof Error ? error.message : "unknown" },
    });

    return {
      title: page.title,
      slug: page.slug,
      pageId: null,
      url: null,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown exception",
    };
  }
}

async function assignHomepage(
  connection: ConnectionProfile,
  homepageId: number | null,
  actionLog: ExecutionActionLog[]
): Promise<ExecutionResult["homepage"]> {
  if (!homepageId) {
    return {
      success: false,
      pageId: null,
      message: "Homepage page ID missing; could not assign front page.",
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
    };
  } catch (error: unknown) {
    return {
      success: false,
      pageId: homepageId,
      message: error instanceof Error ? error.message : "Unknown homepage assignment error.",
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

  const availablePages = pageRecords.filter((record) => record.pageId != null);
  if (!availablePages.length) {
    return { success: false, menuId: null, message: "No created pages available for menu setup." };
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
        message: "Menu API unavailable. Pages were created; configure navigation manually if needed.",
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
  thrive: { enabled: boolean; appliedMappings: string[]; fallbackUsed: boolean }
): Promise<ExecutionResult> {
  const actionLog: ExecutionActionLog[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const pages: ExecutionPageRecord[] = [];
  for (const page of spec.pages) {
    const record = await createPage(connection, page, actionLog);
    pages.push(record);
  }

  if (pages.some((page) => page.status === "failed")) {
    warnings.push("One or more pages failed to create.");
  }

  const homepageRecord = pages.find((page) => page.slug === spec.homepageSlug) ?? null;
  const homepage = await assignHomepage(connection, homepageRecord?.pageId ?? null, actionLog);
  const menu = await createMenu(connection, pages, actionLog);

  if (!homepage.success) warnings.push(homepage.message);
  if (!menu.success) warnings.push(menu.message);

  const success = pages.some((page) => page.status === "created") && errors.length === 0;

  return {
    success,
    createdPages: pages,
    homepage,
    menu,
    thrive,
    actionLog,
    warnings,
    errors,
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
