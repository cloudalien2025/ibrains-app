export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { detectBdPostTypeIds } from "@/app/api/directoryiq/_utils/bdPostTypeDetection";
import { decryptBdSiteKey, formatSiteResponse, getBdSite, updateBdSite, deleteBdSite, isAdminRequest } from "@/app/api/directoryiq/_utils/bdSites";
import { isRawRelationLeakMessage } from "@/app/api/directoryiq/_utils/sqlErrors";

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

function isVerifiedStatus(status: unknown): boolean {
  return status === "verified" || status === "verified_empty";
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
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json({ error: "DirectoryIQ site storage is unavailable in this environment." }, { status: 500 });
    }
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
    let listingsDataId = asNumber(body.listings_data_id ?? body.listingsDataId) ?? existing.listings_data_id;
    let blogPostsDataId = asNumber(body.blog_posts_data_id ?? body.blogPostsDataId) ?? existing.blog_posts_data_id;
    const requestedListingsPath = asString(body.listings_path ?? body.listingsPath);
    const requestedBlogPostsPath = asString(body.blog_posts_path ?? body.blogPostsPath);
    let listingsPath = requestedListingsPath || existing.listings_path || "/api/v2/users_portfolio_groups/search";
    let blogPostsPath = requestedBlogPostsPath || existing.blog_posts_path || null;
    const enabled = typeof body.enabled === "boolean" ? body.enabled : existing.enabled;
    let autodetect: Record<string, unknown> | null = null;

    if (!baseUrl) {
      return NextResponse.json({ error: "base_url is required" }, { status: 400 });
    }

    const effectiveApiKey = apiKey || (existing.secret_ciphertext ? await decryptBdSiteKey(existing) : "");
    if (effectiveApiKey) {
      const detection = await detectBdPostTypeIds({
        baseUrl,
        apiKey: effectiveApiKey,
        listingsPath,
        blogPostsPath,
        configuredListingsDataId: listingsDataId,
        configuredBlogPostsDataId: blogPostsDataId,
      });
      if (listingsDataId == null && isVerifiedStatus(detection.listings.status) && detection.listings.effectiveDataId) {
        listingsDataId = detection.listings.effectiveDataId;
      }
      if (blogPostsDataId == null && isVerifiedStatus(detection.blogPosts.status) && detection.blogPosts.effectiveDataId) {
        blogPostsDataId = detection.blogPosts.effectiveDataId;
      }
      if (!requestedListingsPath) {
        listingsPath = detection.discovery.compatibility.listingsPath || listingsPath;
      }
      if (!requestedBlogPostsPath) {
        blogPostsPath = detection.discovery.compatibility.blogPostsPath || blogPostsPath;
      }
      autodetect = {
        listings: {
          status: detection.listings.status,
          effective_data_id: detection.listings.effectiveDataId,
          auto_detected: detection.listings.autoDetected,
          detected_from: detection.listings.detectedFrom,
          reason: detection.listings.reason,
        },
        blog_posts: {
          status: detection.blogPosts.status,
          effective_data_id: detection.blogPosts.effectiveDataId,
          auto_detected: detection.blogPosts.autoDetected,
          detected_from: detection.blogPosts.detectedFrom,
          reason: detection.blogPosts.reason,
        },
        selected: detection.discovery.selected,
        discovered: detection.discovery.inventory.map((item) => ({
          data_id: item.dataId,
          name: item.name,
          role: item.role,
          confidence: item.confidence,
          auto_enabled: item.autoEnabled,
          sample_count: item.sampleCount,
        })),
      };
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
    return NextResponse.json({ ok: true, site: formatSiteResponse(updated), autodetect });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD site update error";
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json({ error: "DirectoryIQ site storage is unavailable in this environment." }, { status: 500 });
    }
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
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json({ error: "DirectoryIQ site storage is unavailable in this environment." }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
