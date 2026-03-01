export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import {
  isDirectoryIqConnector,
  type DirectoryIqCredentialStatus,
  type DirectoryIqConnector,
} from "@/lib/directoryiq/signalSourceCredentials";
import {
  deleteDirectoryIqIntegration,
  getDirectoryIqIntegration,
  listDirectoryIqIntegrations,
  saveDirectoryIqIntegration,
} from "@/app/api/directoryiq/_utils/credentials";

function connectorToProvider(connector: DirectoryIqConnector): "brilliant_directories" | "openai" | "serpapi" | "ga4" {
  if (connector === "brilliant_directories_api") return "brilliant_directories";
  return connector;
}

function providerToConnector(provider: string): DirectoryIqConnector {
  if (provider === "brilliant_directories") return "brilliant_directories_api";
  if (provider === "openai" || provider === "serpapi" || provider === "ga4") return provider;
  return "openai";
}

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const integrations = await listDirectoryIqIntegrations(userId);
    const connectors: DirectoryIqCredentialStatus[] = integrations.map((row) => ({
      connector_id: providerToConnector(row.provider),
      connected: row.status === "connected",
      label: (row.meta.label as string | null) ?? null,
      masked_secret: row.masked,
      updated_at: row.savedAt,
      config: row.meta as Record<string, string>,
    }));
    return NextResponse.json({ connectors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ signal-source error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json()) as {
      connector_id?: string;
      secret?: string;
      label?: string | null;
      config?: Record<string, string> | null;
    };

    const connectorId = (body.connector_id ?? "").trim().toLowerCase() as DirectoryIqConnector;
    const secret = (body.secret ?? "").trim();

    if (!isDirectoryIqConnector(connectorId)) {
      return NextResponse.json({ error: "Unsupported connector_id" }, { status: 400 });
    }

    if (!secret) {
      return NextResponse.json({ error: "secret is required" }, { status: 400 });
    }

    const configJson =
      body.config && typeof body.config === "object"
        ? Object.fromEntries(
            Object.entries(body.config).filter((entry) => typeof entry[1] === "string" && String(entry[1]).trim().length > 0)
          )
        : {};

    const provider = connectorToProvider(connectorId);
    const meta =
      provider === "brilliant_directories"
        ? {
            baseUrl: (configJson.base_url as string) ?? "",
            listingsPath: (configJson.listings_path as string) ?? "/api/v2/users_portfolio_groups/search",
            blogPostsPath: (configJson.blog_posts_path as string) ?? "/api/v2/data_posts/search",
            listingsDataId: 75,
            label: body.label?.trim() || null,
          }
        : {
            ...configJson,
            label: body.label?.trim() || null,
          };

    await saveDirectoryIqIntegration({
      userId,
      provider,
      secret,
      meta,
    });

    const saved = await getDirectoryIqIntegration(userId, provider);
    return NextResponse.json({ ok: true, connector_id: connectorId, connected: true, saved_at: saved.savedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ credential save error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const connectorId = (req.nextUrl.searchParams.get("connector_id") ?? "").trim().toLowerCase() as DirectoryIqConnector;
    if (!isDirectoryIqConnector(connectorId)) {
      return NextResponse.json({ error: "Unsupported connector_id" }, { status: 400 });
    }

    await deleteDirectoryIqIntegration(userId, connectorToProvider(connectorId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ credential delete error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
