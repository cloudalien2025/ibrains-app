export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { detectBdPostTypeIds } from "@/app/api/directoryiq/_utils/bdPostTypeDetection";
import { decryptBdSiteKey, getBdSite, updateBdSiteDetectedDataIds } from "@/app/api/directoryiq/_utils/bdSites";
import { isRawRelationLeakMessage } from "@/app/api/directoryiq/_utils/sqlErrors";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> | { siteId: string } }
) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);
    const { siteId } = await Promise.resolve(params);

    const site = await getBdSite(userId, siteId);
    if (!site) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!site.secret_ciphertext) return NextResponse.json({ error: "api_key_missing" }, { status: 400 });

    const apiKey = await decryptBdSiteKey(site);
    const listingsPath = asString(site.listings_path) || "/api/v2/users_portfolio_groups/search";
    const detection = await detectBdPostTypeIds({
      baseUrl: site.base_url,
      apiKey,
      listingsPath,
      blogPostsPath: site.blog_posts_path,
      configuredListingsDataId: site.listings_data_id,
      configuredBlogPostsDataId: site.blog_posts_data_id,
    });

    const nextListingsDataId = detection.listings.effectiveDataId;
    const nextBlogPostsDataId = detection.blogPosts.effectiveDataId;
    const persisted: { listings_data_id?: number; blog_posts_data_id?: number } = {};

    if (
      detection.listings.status === "verified" &&
      typeof nextListingsDataId === "number" &&
      site.listings_data_id !== nextListingsDataId
    ) {
      persisted.listings_data_id = nextListingsDataId;
    }
    if (
      detection.blogPosts.status === "verified" &&
      typeof nextBlogPostsDataId === "number" &&
      site.blog_posts_data_id !== nextBlogPostsDataId
    ) {
      persisted.blog_posts_data_id = nextBlogPostsDataId;
    }
    if (persisted.listings_data_id || persisted.blog_posts_data_id) {
      await updateBdSiteDetectedDataIds({
        userId,
        siteId: site.id,
        listingsDataId: persisted.listings_data_id ?? null,
        blogPostsDataId: persisted.blog_posts_data_id ?? null,
      });
    }

    const listings = {
      configured_data_id: detection.listings.configuredDataId,
      effective_data_id: detection.listings.effectiveDataId,
      auto_detected: detection.listings.autoDetected,
      detected_from: detection.listings.detectedFrom,
      status: detection.listings.status,
      reason: detection.listings.reason,
      preflight: {
        ok: detection.listings.status === "verified",
        status: detection.listings.search.status,
        wrapper_status: detection.listings.search.ok ? "success" : null,
        data_type_observed: detection.listings.dataTypeObserved,
      },
      search: {
        ok: detection.listings.search.ok,
        status: detection.listings.search.status,
        count: detection.listings.search.count,
        path: detection.listings.search.path,
      },
      attempts: detection.listings.attempts,
    };
    const blog = {
      configured_data_id: detection.blogPosts.configuredDataId,
      effective_data_id: detection.blogPosts.effectiveDataId,
      auto_detected: detection.blogPosts.autoDetected,
      detected_from: detection.blogPosts.detectedFrom,
      status: detection.blogPosts.status,
      reason: detection.blogPosts.reason,
      search: {
        ok: detection.blogPosts.search.ok,
        status: detection.blogPosts.search.status,
        count: detection.blogPosts.search.count,
        path: detection.blogPosts.search.path,
        tried_paths: detection.blogPosts.search.triedPaths,
      },
      attempts: detection.blogPosts.attempts,
    };

    return NextResponse.json({
      ok: listings.status === "verified",
      verification: {
        listings,
        blog_posts: blog,
      },
      autodetect: {
        persisted,
        diagnostics: detection.diagnostics,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD test error";
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json({ error: "DirectoryIQ site storage is unavailable in this environment." }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
