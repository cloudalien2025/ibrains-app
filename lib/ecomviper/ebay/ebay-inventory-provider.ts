import type {
  EbayDashboardConnectionSummary,
  EbayInventoryImportRequest,
  EbayInventoryImportResult,
  EbayInventoryProvider,
} from "@/lib/ecomviper/ebay/types";
import {
  EBAY_DEFAULT_MARKETPLACE,
  EBAY_READ_ONLY_SCOPE,
  createMockEbayInventoryProvider,
} from "@/lib/ecomviper/ebay/mock-ebay-provider";

interface EbayCredentialSnapshot {
  clientId: string;
  clientSecret: string;
  oauthRedirectUrl: string;
  oauthToken: string;
  marketplace: string;
}

function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function resolveCredentialSnapshot(): EbayCredentialSnapshot {
  return {
    clientId: getEnv("ECOMVIPER_EBAY_CLIENT_ID"),
    clientSecret: getEnv("ECOMVIPER_EBAY_CLIENT_SECRET"),
    oauthRedirectUrl: getEnv("ECOMVIPER_EBAY_OAUTH_REDIRECT_URL"),
    oauthToken: getEnv("ECOMVIPER_EBAY_OAUTH_TOKEN"),
    marketplace: getEnv("ECOMVIPER_EBAY_MARKETPLACE") || EBAY_DEFAULT_MARKETPLACE,
  };
}

function hasEveryCredential(snapshot: EbayCredentialSnapshot): boolean {
  return Boolean(snapshot.clientId && snapshot.clientSecret && snapshot.oauthRedirectUrl && snapshot.oauthToken);
}

export function resolveEbayDashboardConnectionSummary(): EbayDashboardConnectionSummary {
  const snapshot = resolveCredentialSnapshot();
  const configured = hasEveryCredential(snapshot);
  const mode = (getEnv("ECOMVIPER_EBAY_PHASE1_MODE") || "mock").toLowerCase();
  const environmentMode = (getEnv("ECOMVIPER_EBAY_ENV") || "sandbox").toLowerCase();

  const connectionState = mode === "mock" ? "mock_mode" : configured ? "ready_for_credentials" : "not_connected";

  return {
    mode: mode === "mock" ? "mock" : "live-ready",
    connectionState,
    environment: environmentMode === "production" ? "production_placeholder" : "sandbox",
    marketplace: snapshot.marketplace,
    readOnlyScope: EBAY_READ_ONLY_SCOPE,
    checklist: [
      { key: "client_id", label: "eBay Client ID / App ID", configured: Boolean(snapshot.clientId) },
      { key: "client_secret", label: "eBay Client Secret / Cert ID", configured: Boolean(snapshot.clientSecret) },
      { key: "oauth_redirect", label: "OAuth redirect URL", configured: Boolean(snapshot.oauthRedirectUrl) },
      { key: "oauth_token", label: "Seller OAuth authorization token flow", configured: Boolean(snapshot.oauthToken) },
      { key: "marketplace", label: "Marketplace (default EBAY_US)", configured: Boolean(snapshot.marketplace) },
    ],
    readOnlyBoundaryNote:
      "Phase 1 is read-only and mock-first. Listing changes are not pushed to eBay and no seller write actions are enabled.",
  };
}

// Live eBay provider seam. Phase 1 intentionally keeps network calls disabled.
export class LiveReadonlyEbayInventoryProvider implements EbayInventoryProvider {
  readonly mode = "live-ready" as const;

  constructor(private readonly connection: EbayDashboardConnectionSummary) {}

  async importInventoryItems(request: EbayInventoryImportRequest): Promise<EbayInventoryImportResult> {
    void request;
    if (this.connection.connectionState !== "ready_for_credentials") {
      return {
        mode: "live-ready",
        listings: [],
        warnings: [
          "eBay credentials are incomplete. Configure BYO credentials before enabling read-only imports.",
          "Phase 1 keeps live eBay Inventory API calls disabled.",
        ],
      };
    }

    return {
      mode: "live-ready",
      listings: [],
      warnings: [
        "Live getInventoryItems seam is wired but intentionally disabled in Phase 1.",
        "Required OAuth scope for future read-only import: sell.inventory.readonly.",
      ],
    };
  }
}

interface CreateEbayInventoryProviderArgs {
  connection: EbayDashboardConnectionSummary;
}

export function createEbayInventoryProvider({ connection }: CreateEbayInventoryProviderArgs): EbayInventoryProvider {
  if (connection.mode === "mock") {
    return createMockEbayInventoryProvider();
  }
  return new LiveReadonlyEbayInventoryProvider(connection);
}
