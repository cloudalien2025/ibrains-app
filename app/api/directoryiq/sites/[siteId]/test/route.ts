export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { decryptBdSiteKey, getBdSite } from "@/app/api/directoryiq/_utils/bdSites";
import { normalizeBdBaseUrl } from "@/app/api/directoryiq/_utils/bdApi";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function bdGet(baseUrl: string, apiKey: string, path: string) {
  const response = await fetch(`${normalizeBdBaseUrl(baseUrl)}${path}`, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

async function bdPost(baseUrl: string, apiKey: string, path: string, form: Record<string, unknown>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value == null) continue;
    body.set(key, String(value));
  }
  const response = await fetch(`${normalizeBdBaseUrl(baseUrl)}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
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
    if (!site.listings_data_id) return NextResponse.json({ error: "listings_data_id_missing" }, { status: 400 });

    const apiKey = await decryptBdSiteKey(site);
    const preflight = await bdGet(site.base_url, apiKey, `/api/v2/data_categories/get/${site.listings_data_id}`);
    const preflightStatus =
      typeof (preflight.json as Record<string, unknown> | null)?.status === "string"
        ? ((preflight.json as Record<string, unknown>).status as string)
        : null;
    const preflightMessage = (preflight.json as Record<string, unknown> | null)?.message ?? null;
    const dataTypeObserved =
      (preflightMessage as Record<string, unknown> | undefined)?.data_type ??
      (preflight.json as Record<string, unknown> | undefined)?.data_type ??
      null;

    const listingsPath = asString(site.listings_path) || "/api/v2/users_portfolio_groups/search";
    const search = await bdPost(site.base_url, apiKey, listingsPath, {
      action: "search",
      output_type: "array",
      data_id: site.listings_data_id,
      limit: 1,
      page: 1,
    });
    const searchMessage = (search.json as Record<string, unknown> | null)?.message ?? null;
    const searchCount = Array.isArray(searchMessage) ? searchMessage.length : null;

    return NextResponse.json({
      ok: preflight.ok && search.ok,
      preflight: {
        ok: preflight.ok,
        status: preflight.status,
        wrapper_status: preflightStatus,
        data_type_observed: dataTypeObserved,
      },
      search: {
        ok: search.ok,
        status: search.status,
        count: searchCount,
        path: listingsPath,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BD test error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
