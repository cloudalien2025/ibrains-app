export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/app/api/ecomviper/_utils/crypto";
import { query } from "@/app/api/ecomviper/_utils/db";
import { graphqlAdminRequest } from "@/app/api/ecomviper/_utils/shopify";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";

interface IntegrationRow {
  id: string;
  shop_domain: string;
  access_token_ciphertext: string;
}

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const integrationId = req.nextUrl.searchParams.get("integration_id");
    if (!integrationId) {
      return NextResponse.json({ error: "integration_id is required" }, { status: 400 });
    }

    const rows = await query<IntegrationRow>(
      `
      SELECT id, shop_domain, access_token_ciphertext
      FROM integrations
      WHERE id = $1 AND user_id = $2 AND provider = 'shopify'
      LIMIT 1
      `,
      [integrationId, userId]
    );

    const integration = rows[0];
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const token = decryptSecret(integration.access_token_ciphertext, `${userId}:shopify`);

    const data = await graphqlAdminRequest<{ shop: { id: string; name: string } }>({
      shopDomain: integration.shop_domain,
      accessToken: token,
      query: "query VerifyShop { shop { id name } }",
    });

    await query(
      `UPDATE integrations SET last_verified_at = now(), updated_at = now() WHERE id = $1`,
      [integration.id]
    );

    return NextResponse.json({ ok: true, shop: data.shop });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
