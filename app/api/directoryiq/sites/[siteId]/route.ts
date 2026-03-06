export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { formatSiteResponse, getBdSite, updateBdSite, deleteBdSite, isAdminRequest } from "@/app/api/directoryiq/_utils/bdSites";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> | { siteId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const { siteId } = await Promise.resolve(params);
    const site = await getBdSite(userId, siteId);
    if (!site) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({ site: formatSiteResponse(site), is_admin: isAdminRequest(req) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD site error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> | { siteId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { siteId } = await Promise.resolve(params);
    const existing = await getBdSite(userId, siteId);
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const label = asString(body.label) || existing.label;
    const baseUrl = normalizeBaseUrl(asString(body.base_url ?? body.baseUrl) || existing.base_url);
    const apiKey = asString(body.api_key ?? body.apiKey) || null;
    const listingsDataId = asNumber(body.listings_data_id ?? body.listingsDataId) ?? existing.listings_data_id;
    const blogPostsDataId = asNumber(body.blog_posts_data_id ?? body.blogPostsDataId) ?? existing.blog_posts_data_id;
    const listingsPath =
      asString(body.listings_path ?? body.listingsPath) || existing.listings_path || "/api/v2/users_portfolio_groups/search";
    const blogPostsPath = asString(body.blog_posts_path ?? body.blogPostsPath) || existing.blog_posts_path || null;
    const enabled = typeof body.enabled === "boolean" ? body.enabled : existing.enabled;

    if (!baseUrl) {
      return NextResponse.json({ error: "base_url is required" }, { status: 400 });
    }
    if (listingsDataId == null) {
      return NextResponse.json({ error: "listings_data_id is required" }, { status: 400 });
    }

    await updateBdSite({
      userId,
      siteId,
      label,
      baseUrl,
      apiKey,
      listingsDataId,
      blogPostsDataId,
      listingsPath,
      blogPostsPath,
      enabled,
    });

    const updated = await getBdSite(userId, siteId);
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, site: formatSiteResponse(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD site update error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> | { siteId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { siteId } = await Promise.resolve(params);

    await deleteBdSite(userId, siteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD site delete error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
