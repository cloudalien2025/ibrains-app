export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { shouldServeDirectoryIqLocally } from "@/app/api/directoryiq/_utils/runtimeParity";
import { listBdSites } from "@/app/api/directoryiq/_utils/bdSites";
import { hasCanonicalDirectoryIqConnection } from "@/app/api/directoryiq/_utils/connectedState";
import {
  isDirectoryIqConnector,
  type DirectoryIqCredentialStatus,
  type DirectoryIqConnector,
} from "@/lib/directoryiq/signalSourceCredentials";
import {
  deleteDirectoryIqIntegration,
  getDirectoryIqIntegration,
  isDirectoryIqCredentialStoreAvailable,
  listDirectoryIqIntegrations,
  saveDirectoryIqIntegration,
} from "@/app/api/directoryiq/_utils/credentials";
import { isRawRelationLeakMessage } from "@/app/api/directoryiq/_utils/sqlErrors";

function connectorToProvider(connector: DirectoryIqConnector): "brilliant_directories" | "openai" | "serpapi" | "ga4" {
  if (connector === "brilliant_directories_api") return "brilliant_directories";
  return connector;
}

function providerToConnector(provider: string): DirectoryIqConnector {
  if (provider === "brilliant_directories") return "brilliant_directories_api";
  if (provider === "openai" || provider === "serpapi" || provider === "ga4") return provider;
  return "openai";
}

function isNonBdConnector(connector: DirectoryIqConnector): connector is "openai" | "serpapi" | "ga4" {
  return connector === "openai" || connector === "serpapi" || connector === "ga4";
}

function connectorDisplayName(connector: DirectoryIqConnector): string {
  if (connector === "openai") return "OpenAI API";
  if (connector === "serpapi") return "SerpAPI";
  if (connector === "ga4") return "GA4";
  return "Brilliant Directories API";
}

function nonBdStorageUnavailableMessage(connector: "openai" | "serpapi" | "ga4"): string {
  return `${connectorDisplayName(connector)} credential persistence is not available in this environment yet.`;
}

function relationErrorMessageForConnector(connector: DirectoryIqConnector | null): string {
  if (connector && isNonBdConnector(connector)) {
    return nonBdStorageUnavailableMessage(connector);
  }
  return "DirectoryIQ signal-source credentials are unavailable in this environment.";
}

export async function GET(req: NextRequest) {
  if (!shouldServeDirectoryIqLocally(req)) {
    return proxyDirectoryIqRequest(req, "/api/directoryiq/signal-sources", "GET");
  }

  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const [integrations, sites] = await Promise.all([
      listDirectoryIqIntegrations(userId),
      listBdSites(userId),
    ]);
    const nonBdStorageAvailable = await isDirectoryIqCredentialStoreAvailable();
    const canonicalBdConnected = hasCanonicalDirectoryIqConnection(sites);

    const connectors: DirectoryIqCredentialStatus[] = integrations.map((row) => {
      const connectorId = providerToConnector(row.provider);
      const config =
        connectorId === "brilliant_directories_api"
          ? {
              base_url: typeof row.meta.baseUrl === "string" ? row.meta.baseUrl : "",
              listings_path: typeof row.meta.listingsPath === "string" ? row.meta.listingsPath : "/api/v2/users_portfolio_groups/search",
              blog_posts_path: typeof row.meta.blogPostsPath === "string" ? row.meta.blogPostsPath : "/api/v2/data_posts/search",
              blog_posts_data_id: String(
                typeof row.meta.blogPostsDataId === "number"
                  ? row.meta.blogPostsDataId
                  : typeof row.meta.blog_posts_data_id === "number"
                    ? row.meta.blog_posts_data_id
                    : 14
              ),
            }
          : (row.meta as Record<string, string>);

      return {
        connector_id: connectorId,
        connected: connectorId === "brilliant_directories_api" ? canonicalBdConnected : row.status === "connected",
        label: (row.meta.label as string | null) ?? null,
        masked_secret: row.masked,
        updated_at: row.savedAt,
        config,
      };
    });

    const present = new Set(connectors.map((entry) => entry.connector_id));
    for (const connectorId of ["brilliant_directories_api", "openai", "serpapi", "ga4"] as const) {
      if (present.has(connectorId)) continue;
      connectors.push({
        connector_id: connectorId,
        connected: false,
        label: null,
        masked_secret: "",
        updated_at: null,
        config: null,
      });
    }

    const connectorSupport = {
      brilliant_directories_api: true,
      openai: nonBdStorageAvailable,
      serpapi: nonBdStorageAvailable,
      ga4: nonBdStorageAvailable,
    };

    return NextResponse.json({ connectors, connector_support: connectorSupport });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ signal-source error";
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json(
        { error: "DirectoryIQ signal-source credentials are unavailable in this environment." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!shouldServeDirectoryIqLocally(req)) {
    return proxyDirectoryIqRequest(req, "/api/directoryiq/signal-sources", "POST");
  }

  let requestedConnector: DirectoryIqConnector | null = null;
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json()) as {
      connector_id?: string;
      secret?: string;
      label?: string | null;
      config?: Record<string, string | number> | null;
    };

    const connectorId = (body.connector_id ?? "").trim().toLowerCase() as DirectoryIqConnector;
    requestedConnector = connectorId;
    const secret = (body.secret ?? "").trim();

    if (!isDirectoryIqConnector(connectorId)) {
      return NextResponse.json({ error: "Unsupported connector_id" }, { status: 400 });
    }

    if (!secret) {
      return NextResponse.json({ error: "secret is required" }, { status: 400 });
    }

    if (isNonBdConnector(connectorId) && !(await isDirectoryIqCredentialStoreAvailable())) {
      return NextResponse.json(
        { error: nonBdStorageUnavailableMessage(connectorId) },
        { status: 503 }
      );
    }

    const configInput = body.config && typeof body.config === "object" ? body.config : {};
    const readConfigString = (key: string): string => {
      const value = configInput[key];
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return "";
    };
    const readPositiveInteger = (value: string, fallback: number): number => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const provider = connectorToProvider(connectorId);
    const meta =
      provider === "brilliant_directories"
        ? {
            baseUrl: readConfigString("base_url"),
            listingsPath: readConfigString("listings_path") || "/api/v2/users_portfolio_groups/search",
            blogPostsPath: readConfigString("blog_posts_path") || "/api/v2/data_posts/search",
            listingsDataId: 75,
            blogPostsDataId: readPositiveInteger(readConfigString("blog_posts_data_id"), 14),
            label: body.label?.trim() || null,
          }
        : {
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
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json(
        { error: relationErrorMessageForConnector(requestedConnector) },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!shouldServeDirectoryIqLocally(req)) {
    return proxyDirectoryIqRequest(req, "/api/directoryiq/signal-sources", "DELETE");
  }

  let requestedConnector: DirectoryIqConnector | null = null;
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const connectorId = (req.nextUrl.searchParams.get("connector_id") ?? "").trim().toLowerCase() as DirectoryIqConnector;
    requestedConnector = connectorId;
    if (!isDirectoryIqConnector(connectorId)) {
      return NextResponse.json({ error: "Unsupported connector_id" }, { status: 400 });
    }

    if (isNonBdConnector(connectorId) && !(await isDirectoryIqCredentialStoreAvailable())) {
      return NextResponse.json(
        { error: nonBdStorageUnavailableMessage(connectorId) },
        { status: 503 }
      );
    }

    await deleteDirectoryIqIntegration(userId, connectorToProvider(connectorId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DirectoryIQ credential delete error";
    if (isRawRelationLeakMessage(message)) {
      return NextResponse.json(
        { error: relationErrorMessageForConnector(requestedConnector) },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
