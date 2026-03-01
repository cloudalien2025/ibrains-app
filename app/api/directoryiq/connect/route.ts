export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { scheduleSnapshotRefresh } from "@/app/api/_utils/snapshots";
import { saveDirectoryIqIntegration } from "@/app/api/directoryiq/_utils/credentials";

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

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json()) as {
      base_url?: string;
      api_key?: string;
      listings_path?: string;
      blog_posts_path?: string;
    };

    const baseUrl = normalizeBaseUrl(body.base_url ?? "");
    const apiKey = (body.api_key ?? "").trim();
    const listingsPath = (body.listings_path ?? "/api/v2/users_portfolio_groups/search").trim();
    const blogPostsPath = (body.blog_posts_path ?? "/api/v2/data_posts/search").trim();

    if (!baseUrl) {
      return NextResponse.json({ error: "Website URL is required." }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required." }, { status: 400 });
    }

    await saveDirectoryIqIntegration({
      userId,
      provider: "brilliant_directories",
      secret: apiKey,
      meta: {
        baseUrl,
        listingsPath,
        blogPostsPath,
        listingsDataId: 75,
        siteLabel: "Brilliant Directories",
      },
    });

    await scheduleSnapshotRefresh({ userId, brainId: "directoryiq", runIngest: true });

    return NextResponse.json({ ok: true, status: "updating" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connect error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
