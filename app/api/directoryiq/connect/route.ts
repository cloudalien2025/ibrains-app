export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { scheduleSnapshotRefresh } from "@/app/api/_utils/snapshots";

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.host}`;
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
    const listingsPath = (body.listings_path ?? "/wp-json/brilliantdirectories/v1/listings").trim();
    const blogPostsPath = (body.blog_posts_path ?? "/wp-json/wp/v2/posts").trim();

    if (!baseUrl) {
      return NextResponse.json({ error: "Website URL is required." }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required." }, { status: 400 });
    }

    const connectorId = "brilliant_directories_api";
    const ciphertext = encryptSecret(apiKey, `${userId}:directoryiq:${connectorId}`);

    await query(
      `
      INSERT INTO directoryiq_signal_source_credentials
      (user_id, connector_id, secret_ciphertext, secret_last4, secret_length, label, config_json, last_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      ON CONFLICT (user_id, connector_id)
      DO UPDATE SET
        secret_ciphertext = EXCLUDED.secret_ciphertext,
        secret_last4 = EXCLUDED.secret_last4,
        secret_length = EXCLUDED.secret_length,
        label = EXCLUDED.label,
        config_json = EXCLUDED.config_json,
        last_verified_at = now(),
        updated_at = now()
      `,
      [
        userId,
        connectorId,
        ciphertext,
        apiKey.slice(-4),
        apiKey.length,
        "Brilliant Directories",
        JSON.stringify({
          base_url: baseUrl,
          listings_path: listingsPath,
          blog_posts_path: blogPostsPath,
        }),
      ]
    );

    await scheduleSnapshotRefresh({ userId, brainId: "directoryiq", runIngest: true });

    return NextResponse.json({ ok: true, status: "updating" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connect error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
