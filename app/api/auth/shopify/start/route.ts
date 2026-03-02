export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/api/ecomviper/_utils/db";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { normalizeShopDomain } from "@/app/api/ecomviper/_utils/shopify";

function shopifyAuthorizeUrl(params: {
  shopDomain: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string;
}): string {
  const url = new URL(`https://${params.shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("scope", params.scopes);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Shopify integration not configured. Contact admin." },
        { status: 500 }
      );
    }

    const shopInput = req.nextUrl.searchParams.get("shop") ?? "";
    const shopDomain = normalizeShopDomain(shopInput);
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const state = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(
      `
      INSERT INTO oauth_states (user_id, provider, shop_domain, state, expires_at)
      VALUES ($1, 'shopify', $2, $3, $4)
      `,
      [userId, shopDomain, state, expiresAt]
    );

    const scopes = ["read_products", "read_content"].join(",");
    const redirectTo = shopifyAuthorizeUrl({
      shopDomain,
      clientId,
      redirectUri,
      state,
      scopes,
    });

    if (req.nextUrl.searchParams.get("dry_run") === "1") {
      return NextResponse.json({ ok: true, redirect_to: redirectTo });
    }

    return NextResponse.redirect(redirectTo, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Shopify OAuth start error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
