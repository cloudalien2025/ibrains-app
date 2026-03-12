export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser } from "@/app/api/ecomviper/_utils/user";
import { createBdSite, isAdminRequest, listBdSites } from "@/app/api/directoryiq/_utils/bdSites";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { shouldServeDirectoryIqLocally } from "@/app/api/directoryiq/_utils/runtimeParity";
import { resolveDirectoryIqUserId } from "@/app/api/directoryiq/_utils/userContext";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  parsed.search = "";
  parsed.hash = "";
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
}

export async function GET(req: NextRequest) {
  if (!shouldServeDirectoryIqLocally(req)) {
    return proxyDirectoryIqRequest(req, "/api/directoryiq/sites", "GET");
  }

  try {
    const userId = resolveDirectoryIqUserId(req);
    await ensureUser(userId);
    const sites = await listBdSites(userId);
    const isAdmin = isAdminRequest(req);
    const limit = isAdmin ? 999 : Number(process.env.DIRECTORYIQ_BD_SITES_LIMIT ?? "1");

    return NextResponse.json({ sites, is_admin: isAdmin, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD sites error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!shouldServeDirectoryIqLocally(req)) {
    return proxyDirectoryIqRequest(req, "/api/directoryiq/sites", "POST");
  }

  try {
    const userId = resolveDirectoryIqUserId(req);
    await ensureUser(userId);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const label = asString(body.label) || null;
    const baseUrl = normalizeBaseUrl(asString(body.base_url ?? body.baseUrl));
    const apiKey = asString(body.api_key ?? body.apiKey);
    const listingsDataId = asNumber(body.listings_data_id ?? body.listingsDataId);
    const blogPostsDataId = asNumber(body.blog_posts_data_id ?? body.blogPostsDataId);
    const listingsPath =
      asString(body.listings_path ?? body.listingsPath) || "/api/v2/users_portfolio_groups/search";
    const blogPostsPath = asString(body.blog_posts_path ?? body.blogPostsPath) || null;
    const enabled = body.enabled === false ? false : true;

    if (!baseUrl) {
      return NextResponse.json({ error: "base_url is required" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "api_key is required" }, { status: 400 });
    }
    if (listingsDataId == null) {
      return NextResponse.json({ error: "listings_data_id is required" }, { status: 400 });
    }

    const isAdmin = isAdminRequest(req);
    const limit = isAdmin ? 999 : Number(process.env.DIRECTORYIQ_BD_SITES_LIMIT ?? "1");

    const site = await createBdSite({
      userId,
      label,
      baseUrl,
      apiKey,
      listingsDataId,
      blogPostsDataId,
      listingsPath,
      blogPostsPath,
      enabled,
      limit,
    });

    return NextResponse.json({ ok: true, site });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD site create error";
    if (message === "bd_site_limit_reached") {
      return NextResponse.json({ error: "bd_site_limit_reached" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
