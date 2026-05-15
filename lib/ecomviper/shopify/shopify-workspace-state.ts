import "server-only";

import { buildShopifyAgenticDemoWorkspaceState } from "@/lib/ecomviper/shopify/shopify-agentic-demo-data";
import { buildShopifyNextBestActions } from "@/lib/ecomviper/shopify/shopify-ai-referral-opportunities";
import { evaluateShopifyAgenticPromptMatch } from "@/lib/ecomviper/shopify/shopify-agentic-test-queries";
import { buildShopifyAgenticReadinessScore } from "@/lib/ecomviper/shopify/shopify-agentic-readiness";
import {
  type ShopifyAgenticWorkspaceState,
  type ShopifyKnowledgeBaseQuestion,
  type ShopifyPolicyCoverage,
  type ShopifyProductAgenticFact,
  type ShopifySemanticGap,
  type ShopifyTrustSignal,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";
import {
  getShopifyConnectionStatusForUser,
} from "@/lib/ecomviper/shopify/shopify-connection";
import {
  getShopifyImportStateForUser,
  listShopifyProductsForUser,
} from "@/lib/ecomviper/shopify/shopify-import";
import {
  hydrateShopifyLiveWorkspaceForUser,
  type ShopifyLiveHydrationResult,
} from "@/lib/ecomviper/shopify/shopify-live-hydrator";
import {
  getShopifyOpenAiConnectionStatusForUser,
} from "@/lib/ecomviper/shopify/openai-connection";
import {
  getShopifySerpApiConnectionStatusForUser,
} from "@/lib/ecomviper/shopify/serpapi-connection";
import {
  buildMockShopifyMcpDiagnostics,
  buildShopifyStorefrontMcpEndpoints,
  runShopifyMcpDiagnostics,
} from "@/lib/ecomviper/shopify/shopify-storefront-mcp-diagnostics";
import {
  buildShopifyEntitySourceProvenance,
  sourceLabel,
  sourceToHydrationMode,
} from "@/lib/ecomviper/shopify/shopify-source-provenance";
import type {
  ShopifyImportState,
  ShopifyConnectionStatus,
  ShopifyOpenAiConnectionStatus,
  ShopifyProductRecord,
  ShopifySerpApiConnectionStatus,
} from "@/lib/ecomviper/shopify/shopify-types";

interface WorkspaceOptions {
  userId: string | null;
  demoMode?: boolean;
}

function emptyImportState(): ShopifyImportState {
  return {
    lastImportAt: null,
    lastImportStatus: "unknown",
    lastImportMessage: null,
    productCount: 0,
    imageCount: 0,
    updatedAt: null,
  };
}

function disconnectedShopifyStatus(): ShopifyConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    storeDomain: "",
    apiVersion: "2025-10",
    authMode: "dev_dashboard_client_credentials",
    maskedClientId: "Not configured",
    clientSecretStored: false,
    tokenStatus: "unknown",
    lastTokenRefreshAt: null,
    tokenExpiresAt: null,
    grantedScopes: [],
    lastApiError: null,
    updatedAt: null,
    saveSupported: false,
  };
}

function disconnectedOpenAiStatus(): ShopifyOpenAiConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    maskedApiKey: "Not configured",
    updatedAt: null,
    saveSupported: false,
    lastTestedAt: null,
    lastError: null,
  };
}

function disconnectedSerpApiStatus(): ShopifySerpApiConnectionStatus {
  return {
    connected: false,
    status: "disconnected",
    maskedApiKey: "Not configured",
    updatedAt: null,
    saveSupported: false,
    lastTestedAt: null,
    lastScanAt: null,
    lastError: null,
  };
}

function safeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function scoreFromChecks(checks: Array<boolean>): number {
  if (!checks.length) return 0;
  const available = checks.filter(Boolean).length;
  return Math.round((available / checks.length) * 100);
}

function scoreFromRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function toProductFacts(products: ShopifyProductRecord[]): ShopifyProductAgenticFact[] {
  return products.slice(0, 250).map((product, index) => {
    const productId = safeText(product.id);
    const handle = safeText(product.handle);
    const editorIdentifier = handle || productId || null;

    const nonEmptyAltCount = product.galleryImages.filter((image) => safeText(image.altText || "").length > 0).length;
    const imageAltTextReadiness = scoreFromRatio(nonEmptyAltCount, Math.max(1, product.galleryImages.length));

    const variantWithIdentityCount = product.variants.filter(
      (variant) => safeText(variant.sku).length > 0 || safeText(variant.barcode).length > 0
    ).length;

    const productFactsReadiness = scoreFromChecks([
      safeText(product.vendor).length > 0,
      safeText(product.productType).length > 0,
      safeText(product.description).length >= 70,
      product.variants.length > 0,
      variantWithIdentityCount > 0,
      product.tags.length > 0,
    ]);

    const titleDescriptionReadiness = scoreFromChecks([
      safeText(product.title).length >= 8,
      safeText(product.description).length >= 90,
      safeText(product.seoTitle).length >= 15,
      safeText(product.seoDescription).length >= 40,
      safeText(product.handle).length > 0,
    ]);

    const schemaMetafieldReadiness = scoreFromChecks([
      product.metafields.length > 0,
      product.metafields.some((entry) => safeText(entry.value).length > 0),
      safeText(product.seoTitle).length > 0,
      safeText(product.seoDescription).length > 0,
      safeText(product.onlineStoreUrl).length > 0,
    ]);

    const productFaqReadiness = scoreFromChecks([
      safeText(product.description).length >= 100,
      product.tags.length >= 2,
      product.variants.length > 0,
      product.galleryImageUrls.length > 0,
      safeText(product.vendor).length > 0,
    ]);

    const notes: string[] = [];
    if (!safeText(product.seoTitle)) notes.push("Missing SEO title");
    if (!safeText(product.seoDescription)) notes.push("Missing SEO description");
    if (imageAltTextReadiness < 65) notes.push("Image alt-text coverage is low");
    if (!product.metafields.length) notes.push("No metafields detected");

    return {
      id: productId || handle || `shopify_product_unavailable_${index + 1}`,
      title: product.title || product.handle || "Untitled product",
      handle: handle || undefined,
      editorIdentifier,
      editorLinkEnabled: Boolean(editorIdentifier),
      editorLinkDisabledReason: editorIdentifier ? null : "No stable Shopify product id/handle available.",
      category: product.productType || product.vendor || "Uncategorized",
      sourceLabel: "Live Shopify API",
      productFactsReadiness,
      titleDescriptionReadiness,
      imageAltTextReadiness,
      schemaMetafieldReadiness,
      productFaqReadiness,
      agenticReferralNotes: notes.length > 0 ? notes.join("; ") : "Product has strong baseline coverage.",
    };
  });
}

function findFirstPageBodyByKeyword(pages: Array<{ title: string; body: string }>, keyword: string): string {
  const lower = keyword.toLowerCase();
  const match = pages.find((page) => {
    const title = page.title.toLowerCase();
    const body = page.body.toLowerCase();
    return title.includes(lower) || body.includes(lower);
  });
  return safeText(match?.body || "");
}

function findFirstBlogBodyByKeyword(
  articles: Array<{ title: string; contentHtml: string; excerpt: string }>,
  keyword: string
): string {
  const lower = keyword.toLowerCase();
  const match = articles.find((article) => {
    const title = article.title.toLowerCase();
    const excerpt = article.excerpt.toLowerCase();
    const body = article.contentHtml.toLowerCase();
    return title.includes(lower) || excerpt.includes(lower) || body.includes(lower);
  });
  return safeText(match?.excerpt || match?.contentHtml || "");
}

function buildPolicyCoverage(input: {
  policies: ShopifyLiveHydrationResult["policies"];
  pages: ShopifyLiveHydrationResult["pages"];
  blogArticles: ShopifyLiveHydrationResult["blogArticles"];
  serpApiConnected: boolean;
}): ShopifyPolicyCoverage[] {
  const byTitle = new Map<string, string>();
  for (const policy of input.policies) {
    byTitle.set(policy.title.toLowerCase(), safeText(policy.body));
  }

  const shipping = byTitle.get("shipping policy") || findFirstPageBodyByKeyword(input.pages, "shipping");
  const returns = byTitle.get("refund policy") || findFirstPageBodyByKeyword(input.pages, "return");
  const terms = byTitle.get("terms of service") || findFirstPageBodyByKeyword(input.pages, "terms");
  const wholesale = findFirstPageBodyByKeyword(input.pages, "wholesale") || findFirstBlogBodyByKeyword(input.blogArticles, "wholesale");
  const support =
    findFirstPageBodyByKeyword(input.pages, "contact") ||
    findFirstPageBodyByKeyword(input.pages, "support") ||
    findFirstBlogBodyByKeyword(input.blogArticles, "support");
  const international =
    shipping.toLowerCase().includes("international")
      ? shipping
      : findFirstPageBodyByKeyword(input.pages, "international");

  return [
    {
      id: "policy_shipping",
      policyType: "shipping",
      title: "Shipping Policy",
      available: shipping.length > 0,
      summary: shipping || "Shipping policy not found in live content.",
    },
    {
      id: "policy_returns",
      policyType: "returns",
      title: "Returns Policy",
      available: returns.length > 0,
      summary: returns || "Returns policy not found in live content.",
    },
    {
      id: "policy_wholesale",
      policyType: "wholesale",
      title: "Wholesale Policy",
      available: wholesale.length > 0,
      summary: wholesale || "Wholesale guidance not found in live content.",
    },
    {
      id: "policy_support",
      policyType: "support",
      title: "Support Policy",
      available: support.length > 0,
      summary: support || terms || "Support contact guidance not found in live content.",
    },
    {
      id: "policy_international",
      policyType: "international",
      title: "International Shipping",
      available: international.length > 0,
      summary: international || "International shipping details not found in live content.",
    },
    {
      id: "policy_marketplaces",
      policyType: "marketplace_availability",
      title: "Marketplace Availability",
      available: input.serpApiConnected,
      summary: input.serpApiConnected
        ? "External visibility scanning is connected via SerpAPI."
        : "SerpAPI is not connected; marketplace visibility checks are unavailable.",
    },
  ];
}

function buildTrustSignals(input: {
  shop: ShopifyLiveHydrationResult["shop"];
  policyCoverage: ShopifyPolicyCoverage[];
  serpApiConnected: boolean;
}): ShopifyTrustSignal[] {
  const internationalAvailable = input.policyCoverage.find((policy) => policy.policyType === "international")?.available ?? false;
  const supportPolicy = input.policyCoverage.find((policy) => policy.policyType === "support");
  const returnsPolicy = input.policyCoverage.find((policy) => policy.policyType === "returns");

  return [
    {
      id: "brand_name",
      label: "Brand",
      value: input.shop.name || "Not available",
      available: Boolean(input.shop.name),
      impact: "high",
    },
    {
      id: "support_email",
      label: "Support Email",
      value: input.shop.email || "Not available",
      available: Boolean(input.shop.email),
      impact: "high",
    },
    {
      id: "international_shipping",
      label: "International Shipping",
      value: internationalAvailable ? "Available in live policy content" : "Not found",
      available: internationalAvailable,
      impact: "high",
    },
    {
      id: "marketplace_availability",
      label: "Marketplace Visibility",
      value: input.serpApiConnected ? "SerpAPI connected" : "SerpAPI not connected",
      available: input.serpApiConnected,
      impact: "medium",
    },
    {
      id: "secure_checkout",
      label: "Secure Checkout",
      value: "Shopify checkout",
      available: true,
      impact: "high",
    },
    {
      id: "return_support_policies",
      label: "Return + Support Policies",
      value:
        supportPolicy?.available || returnsPolicy?.available
          ? "Published in live content"
          : "Missing from live content",
      available: Boolean(supportPolicy?.available || returnsPolicy?.available),
      impact: "medium",
    },
  ];
}

function buildKnowledgeQuestions(input: {
  products: ShopifyProductRecord[];
  policyCoverage: ShopifyPolicyCoverage[];
  trustSignals: ShopifyTrustSignal[];
  blogArticles: ShopifyLiveHydrationResult["blogArticles"];
}): Array<Pick<ShopifyKnowledgeBaseQuestion, "id" | "category" | "question" | "currentAnswer">> {
  const shipping = input.policyCoverage.find((policy) => policy.policyType === "shipping")?.summary || "";
  const wholesale = input.policyCoverage.find((policy) => policy.policyType === "wholesale")?.summary || "";
  const support = input.policyCoverage.find((policy) => policy.policyType === "support")?.summary || "";
  const international = input.policyCoverage.find((policy) => policy.policyType === "international")?.summary || "";
  const marketplaces = input.policyCoverage.find((policy) => policy.policyType === "marketplace_availability")?.summary || "";

  const topProducts = input.products
    .slice(0, 3)
    .map((product) => product.title)
    .filter((value) => value.length > 0)
    .join(", ");

  const supplementSafetyFromBlogs = findFirstBlogBodyByKeyword(input.blogArticles, "supplement") ||
    "";

  const supportEmail = input.trustSignals.find((signal) => signal.id === "support_email")?.value || "";

  return [
    {
      id: "kb_shipping_international",
      category: "international",
      question: "Does this Shopify store ship internationally?",
      currentAnswer: international || shipping,
    },
    {
      id: "kb_hydration_fasting",
      category: "product_guidance",
      question: "Which products are most relevant for hydration and fasting support?",
      currentAnswer: topProducts ? `Top live products: ${topProducts}.` : "",
    },
    {
      id: "kb_wholesale",
      category: "wholesale",
      question: "Do you offer wholesale pricing?",
      currentAnswer: wholesale,
    },
    {
      id: "kb_marketplaces",
      category: "marketplace_availability",
      question: "Where can I buy these products outside Shopify?",
      currentAnswer: marketplaces,
    },
    {
      id: "kb_support",
      category: "support",
      question: "How do I contact support?",
      currentAnswer: support || (supportEmail && supportEmail !== "Not available" ? `Contact ${supportEmail}.` : ""),
    },
    {
      id: "kb_supplement_safety",
      category: "supplement_safety",
      question: "Are these products intended to diagnose, treat, cure, or prevent disease?",
      currentAnswer: supplementSafetyFromBlogs,
    },
    {
      id: "kb_bundle",
      category: "product_guidance",
      question: "What bundle or product combination should I consider first?",
      currentAnswer: topProducts ? `Recommended starting products: ${topProducts}.` : "",
    },
  ];
}

function buildSemanticGaps(input: {
  products: ShopifyProductRecord[];
  knowledgeGapCount: number;
  policyCoverage: ShopifyPolicyCoverage[];
}): ShopifySemanticGap[] {
  const gaps: ShopifySemanticGap[] = [];

  const seoMissingCount = input.products.filter(
    (product) => safeText(product.seoTitle).length === 0 || safeText(product.seoDescription).length === 0
  ).length;
  if (seoMissingCount > 0) {
    gaps.push({
      id: "semantic_gap_missing_seo",
      topic: "Missing SEO metadata in live products",
      severity: seoMissingCount >= 5 ? "high" : "medium",
      explanation: `${seoMissingCount} live products are missing SEO title or description fields.`,
      recommendedAction: "Populate product SEO title/description in Shopify for stronger search and AI retrieval context.",
    });
  }

  const missingPolicies = input.policyCoverage.filter((policy) => !policy.available).length;
  if (missingPolicies > 0) {
    gaps.push({
      id: "semantic_gap_policy_coverage",
      topic: "Policy and support content gaps",
      severity: missingPolicies >= 3 ? "high" : "medium",
      explanation: `${missingPolicies} policy categories are missing live content coverage.`,
      recommendedAction: "Publish missing policy pages (shipping, returns, support, wholesale) and keep summaries explicit.",
    });
  }

  if (input.knowledgeGapCount > 0) {
    gaps.push({
      id: "semantic_gap_kb_questions",
      topic: "Knowledge base answer depth",
      severity: input.knowledgeGapCount >= 4 ? "high" : "medium",
      explanation: `${input.knowledgeGapCount} Knowledge Base question(s) remain partial or missing.`,
      recommendedAction: "Review generated responses and publish complete answers from live Shopify content.",
    });
  }

  if (!gaps.length) {
    gaps.push({
      id: "semantic_gap_none",
      topic: "No critical semantic gaps detected",
      severity: "low",
      explanation: "Live product and policy coverage looks healthy for current lane diagnostics.",
      recommendedAction: "Maintain freshness by rerunning sync after major catalog/content updates.",
    });
  }

  return gaps;
}

function emptyKnowledgeSummary() {
  return {
    coveragePercent: 0,
    coveredCount: 0,
    partialCount: 0,
    missingCount: 0,
    missingBuyerQuestions: 0,
    policyGapCount: 0,
    brandVoiceGuardrails: [],
    queryLogPlaceholder: ["Connect Shopify and sync to generate query logs from live content."],
    generatedFaqBundle: "Connect Shopify to hydrate real FAQ and policy answers.",
  };
}

function baseUnavailableState(input: {
  storeDomain: string;
  shopifyStatus: ShopifyConnectionStatus;
  openAiStatus: ShopifyOpenAiConnectionStatus;
  serpApiStatus: ShopifySerpApiConnectionStatus;
  importState: ShopifyImportState;
  demoMode: boolean;
  sourceWarnings?: string[];
  sourceErrors?: string[];
}): ShopifyAgenticWorkspaceState {
  const storeDomain = input.storeDomain;
  const mcpEndpoints = buildShopifyStorefrontMcpEndpoints(storeDomain || "opanutrition.myshopify.com");
  const mcpDiagnostics = buildMockShopifyMcpDiagnostics({
    storeDomain: storeDomain || "opanutrition.myshopify.com",
    statusByEndpoint: {
      storefront_mcp: input.shopifyStatus.connected ? "needs_credentials" : "not_configured",
      storefront_ucp_mcp: "not_configured",
    },
  });

  const products: ShopifyProductAgenticFact[] = [];
  const policyCoverage: ShopifyPolicyCoverage[] = [
    {
      id: "policy_shipping",
      policyType: "shipping",
      title: "Shipping Policy",
      available: false,
      summary: "Connect Shopify to hydrate live policy content.",
    },
    {
      id: "policy_returns",
      policyType: "returns",
      title: "Returns Policy",
      available: false,
      summary: "Connect Shopify to hydrate live policy content.",
    },
    {
      id: "policy_wholesale",
      policyType: "wholesale",
      title: "Wholesale Policy",
      available: false,
      summary: "Connect Shopify to hydrate live policy content.",
    },
    {
      id: "policy_support",
      policyType: "support",
      title: "Support Policy",
      available: false,
      summary: "Connect Shopify to hydrate live policy content.",
    },
    {
      id: "policy_international",
      policyType: "international",
      title: "International Shipping",
      available: false,
      summary: "Connect Shopify to hydrate live policy content.",
    },
    {
      id: "policy_marketplaces",
      policyType: "marketplace_availability",
      title: "Marketplace Availability",
      available: false,
      summary: "Connect SerpAPI to run visibility scans.",
    },
  ];

  const trustSignals: ShopifyTrustSignal[] = [
    {
      id: "support_email",
      label: "Support Email",
      value: "Unavailable",
      available: false,
      impact: "high",
    },
    {
      id: "marketplace_availability",
      label: "Marketplace Visibility",
      value: input.serpApiStatus.connected ? "SerpAPI connected" : "Unavailable",
      available: input.serpApiStatus.connected,
      impact: "medium",
    },
  ];

  const knowledgeBaseQuestions: ShopifyAgenticWorkspaceState["knowledgeBaseQuestions"] = [];
  const knowledgeBaseSummary = emptyKnowledgeSummary();
  const knowledgeBaseGaps: ShopifyAgenticWorkspaceState["knowledgeBaseGaps"] = [];
  const testQueries: ShopifyAgenticWorkspaceState["testQueries"] = [];
  const semanticGaps: ShopifySemanticGap[] = [
    {
      id: "semantic_gap_connect_shopify",
      topic: "Live Shopify connection required",
      severity: "high",
      explanation: "No live Shopify catalog is available for this workspace.",
      recommendedAction: "Connect Shopify Admin API, then run Sync Now to hydrate real data.",
    },
  ];

  const readiness = buildShopifyAgenticReadinessScore({
    mcpDiagnostics,
    products,
    knowledgeBaseSummary,
    policyCoverage,
    trustSignals,
    testQueries,
    semanticGaps,
  });

  const nextBestActions = buildShopifyNextBestActions({
    readiness,
    knowledgeBaseGaps,
    semanticGaps,
    testQueries,
  });

  return {
    storeName: storeDomain || "Shopify workspace",
    storeDomain,
    environmentLabel: input.demoMode ? "Demo mode" : "Connect required",
    storeLabel: storeDomain || "Not connected",
    modeLabel: input.demoMode
      ? "Demo data enabled"
      : "Live data unavailable - connect Shopify to hydrate",
    workspaceSource: input.demoMode ? "demo" : "unavailable",
    workspaceSourceLabel: sourceLabel(input.demoMode ? "demo" : "unavailable"),
    hydrationMode: sourceToHydrationMode(input.demoMode ? "demo" : "unavailable"),
    mockModeEnabled: input.demoMode,
    mockFallbackActive: false,
    sourceWarnings: input.sourceWarnings ?? [],
    sourceErrors: input.sourceErrors ?? [],
    lastSyncedAt: input.importState.lastImportAt,
    lastVisibilityScanAt: input.serpApiStatus.lastScanAt,
    connectionStatus: {
      shopify: {
        connected: input.shopifyStatus.connected,
        mode: input.shopifyStatus.connected ? "live" : input.demoMode ? "demo" : "unavailable",
        credentialSource: input.shopifyStatus.connected ? "secure_store" : input.demoMode ? "demo" : "none",
        maskedCredential: input.shopifyStatus.maskedClientId,
        lastTestedAt: input.shopifyStatus.lastTokenRefreshAt,
        lastSyncAt: input.importState.lastImportAt,
        lastError: input.shopifyStatus.lastApiError?.message || input.importState.lastImportMessage,
        statusLabel: input.shopifyStatus.connected ? "Live" : input.demoMode ? "Demo" : "Not connected",
      },
      openai: {
        connected: input.openAiStatus.connected,
        mode: input.openAiStatus.connected ? "live" : "unavailable",
        credentialSource: input.openAiStatus.connected ? "secure_store" : "none",
        maskedCredential: input.openAiStatus.maskedApiKey,
        lastTestedAt: input.openAiStatus.lastTestedAt,
        lastError: input.openAiStatus.lastError,
        statusLabel: input.openAiStatus.connected ? "Connected" : "Not connected",
      },
      serpapi: {
        connected: input.serpApiStatus.connected,
        mode: input.serpApiStatus.connected ? "live" : "unavailable",
        credentialSource: input.serpApiStatus.connected ? "secure_store" : "none",
        maskedCredential: input.serpApiStatus.maskedApiKey,
        lastTestedAt: input.serpApiStatus.lastTestedAt,
        lastScanAt: input.serpApiStatus.lastScanAt,
        lastError: input.serpApiStatus.lastError,
        statusLabel: input.serpApiStatus.connected ? "Connected" : "Not connected",
      },
    },
    entitySourceProvenance: [
      buildShopifyEntitySourceProvenance({
        entityType: "shop",
        source: input.demoMode ? "demo" : "unavailable",
        fetchedAt: null,
        storeDomain,
        rawId: null,
        connectionId: null,
      }),
    ],
    catalogCounts: {
      products: 0,
      collections: 0,
      pages: 0,
      blogArticles: 0,
      policies: 0,
    },
    storefrontMcpEndpoints: mcpEndpoints,
    mcpDiagnostics,
    products,
    policyCoverage,
    trustSignals,
    knowledgeBaseQuestions,
    knowledgeBaseGaps,
    knowledgeBaseSummary,
    testQueries,
    semanticGaps,
    readiness,
    nextBestActions,
  };
}

async function buildLiveState(input: {
  live: ShopifyLiveHydrationResult;
  importState: ShopifyImportState;
  shopifyStatus: ShopifyConnectionStatus;
  openAiStatus: ShopifyOpenAiConnectionStatus;
  serpApiStatus: ShopifySerpApiConnectionStatus;
}): Promise<ShopifyAgenticWorkspaceState> {
  const products = toProductFacts(input.live.products);

  const policyCoverage = buildPolicyCoverage({
    policies: input.live.policies,
    pages: input.live.pages,
    blogArticles: input.live.blogArticles,
    serpApiConnected: input.serpApiStatus.connected,
  });

  const trustSignals = buildTrustSignals({
    shop: input.live.shop,
    policyCoverage,
    serpApiConnected: input.serpApiStatus.connected,
  });

  const knowledgeBaseInputQuestions = buildKnowledgeQuestions({
    products: input.live.products,
    policyCoverage,
    trustSignals,
    blogArticles: input.live.blogArticles,
  });

  const knowledgeBaseReadiness = await import("@/lib/ecomviper/shopify/shopify-knowledge-base-readiness").then((mod) =>
    mod.evaluateShopifyKnowledgeBaseReadiness({
      questions: knowledgeBaseInputQuestions,
      policyCoverage,
      trustSignals,
      storeContext: {
        storeName: input.live.shop.name || input.live.shop.myshopifyDomain,
        supportEmail: input.live.shop.email || "support@" + input.live.shop.myshopifyDomain,
        shipsInternationally: policyCoverage.find((policy) => policy.policyType === "international")?.available ?? false,
        wholesaleAvailable: policyCoverage.find((policy) => policy.policyType === "wholesale")?.available ?? false,
        marketplaces: ["Shopify", "Google"],
      },
    })
  );

  const semanticGaps = buildSemanticGaps({
    products: input.live.products,
    knowledgeGapCount: knowledgeBaseReadiness.gaps.length,
    policyCoverage,
  });

  const testQueries = evaluateShopifyAgenticPromptMatch({
    knowledgeBaseQuestions: knowledgeBaseReadiness.questions,
    policies: policyCoverage,
    trustSignals,
    products,
  });

  const mcpDiagnostics = input.shopifyStatus.connected
    ? await runShopifyMcpDiagnostics({
        storeDomain: input.live.storeDomain,
        enableLiveProbe: process.env.ECOMVIPER_SHOPIFY_ENABLE_LIVE_MCP_PROBE === "1",
      })
    : buildMockShopifyMcpDiagnostics({
        storeDomain: input.live.storeDomain,
        statusByEndpoint: {
          storefront_mcp: "not_configured",
          storefront_ucp_mcp: "not_configured",
        },
      });

  const readiness = buildShopifyAgenticReadinessScore({
    mcpDiagnostics,
    products,
    knowledgeBaseSummary: knowledgeBaseReadiness.summary,
    policyCoverage,
    trustSignals,
    testQueries,
    semanticGaps,
  });

  const nextBestActions = buildShopifyNextBestActions({
    readiness,
    knowledgeBaseGaps: knowledgeBaseReadiness.gaps,
    semanticGaps,
    testQueries,
  });

  return {
    storeName: input.live.shop.name || input.live.shop.myshopifyDomain,
    storeDomain: input.live.storeDomain,
    environmentLabel: "Live workspace",
    storeLabel: input.live.storeDomain,
    modeLabel: "Live data hydration",
    workspaceSource: "live_shopify",
    workspaceSourceLabel: sourceLabel("live_shopify"),
    hydrationMode: "live",
    mockModeEnabled: false,
    mockFallbackActive: false,
    sourceWarnings: input.live.warnings,
    sourceErrors: input.live.errors,
    lastSyncedAt: input.live.fetchedAt,
    lastVisibilityScanAt: input.serpApiStatus.lastScanAt,
    connectionStatus: {
      shopify: {
        connected: true,
        mode: "live",
        credentialSource: "secure_store",
        maskedCredential: input.shopifyStatus.maskedClientId,
        lastTestedAt: input.shopifyStatus.lastTokenRefreshAt,
        lastSyncAt: input.live.fetchedAt,
        lastError: input.shopifyStatus.lastApiError?.message || null,
        statusLabel: "Live",
      },
      openai: {
        connected: input.openAiStatus.connected,
        mode: input.openAiStatus.connected ? "live" : "unavailable",
        credentialSource: input.openAiStatus.connected ? "secure_store" : "none",
        maskedCredential: input.openAiStatus.maskedApiKey,
        lastTestedAt: input.openAiStatus.lastTestedAt,
        lastError: input.openAiStatus.lastError,
        statusLabel: input.openAiStatus.connected ? "Connected" : "Not connected",
      },
      serpapi: {
        connected: input.serpApiStatus.connected,
        mode: input.serpApiStatus.connected ? "live" : "unavailable",
        credentialSource: input.serpApiStatus.connected ? "secure_store" : "none",
        maskedCredential: input.serpApiStatus.maskedApiKey,
        lastTestedAt: input.serpApiStatus.lastTestedAt,
        lastScanAt: input.serpApiStatus.lastScanAt,
        lastError: input.serpApiStatus.lastError,
        statusLabel: input.serpApiStatus.connected ? "Connected" : "Not connected",
      },
    },
    entitySourceProvenance: input.live.entitySourceProvenance,
    catalogCounts: {
      products: input.live.products.length,
      collections: input.live.collections.length,
      pages: input.live.pages.length,
      blogArticles: input.live.blogArticles.length,
      policies: input.live.policies.length,
    },
    storefrontMcpEndpoints: buildShopifyStorefrontMcpEndpoints(input.live.storeDomain),
    mcpDiagnostics,
    products,
    policyCoverage,
    trustSignals,
    knowledgeBaseQuestions: knowledgeBaseReadiness.questions,
    knowledgeBaseGaps: knowledgeBaseReadiness.gaps,
    knowledgeBaseSummary: knowledgeBaseReadiness.summary,
    testQueries,
    semanticGaps,
    readiness,
    nextBestActions,
  };
}

function buildFallbackState(input: {
  products: ShopifyProductRecord[];
  storeDomain: string;
  shopifyStatus: ShopifyConnectionStatus;
  openAiStatus: ShopifyOpenAiConnectionStatus;
  serpApiStatus: ShopifySerpApiConnectionStatus;
  importState: ShopifyImportState;
  warning: string;
}): ShopifyAgenticWorkspaceState {
  const productFacts = toProductFacts(input.products).map((entry) => ({
    ...entry,
    sourceLabel: "Fallback snapshot" as const,
  }));

  const policyCoverage: ShopifyPolicyCoverage[] = [
    {
      id: "policy_shipping",
      policyType: "shipping",
      title: "Shipping Policy",
      available: false,
      summary: "Policy data unavailable in fallback snapshot.",
    },
    {
      id: "policy_returns",
      policyType: "returns",
      title: "Returns Policy",
      available: false,
      summary: "Policy data unavailable in fallback snapshot.",
    },
    {
      id: "policy_wholesale",
      policyType: "wholesale",
      title: "Wholesale Policy",
      available: false,
      summary: "Policy data unavailable in fallback snapshot.",
    },
    {
      id: "policy_support",
      policyType: "support",
      title: "Support Policy",
      available: false,
      summary: "Policy data unavailable in fallback snapshot.",
    },
    {
      id: "policy_international",
      policyType: "international",
      title: "International Shipping",
      available: false,
      summary: "Policy data unavailable in fallback snapshot.",
    },
    {
      id: "policy_marketplaces",
      policyType: "marketplace_availability",
      title: "Marketplace Availability",
      available: input.serpApiStatus.connected,
      summary: input.serpApiStatus.connected ? "SerpAPI connected." : "SerpAPI not connected.",
    },
  ];

  const trustSignals: ShopifyTrustSignal[] = [
    {
      id: "brand_name",
      label: "Brand",
      value: "Fallback snapshot",
      available: true,
      impact: "medium",
    },
    {
      id: "marketplace_availability",
      label: "Marketplace Visibility",
      value: input.serpApiStatus.connected ? "SerpAPI connected" : "Unavailable",
      available: input.serpApiStatus.connected,
      impact: "low",
    },
  ];

  const knowledgeBaseSummary = emptyKnowledgeSummary();
  const testQueries: ShopifyAgenticWorkspaceState["testQueries"] = [];
  const semanticGaps: ShopifySemanticGap[] = [
    {
      id: "semantic_gap_fallback_snapshot",
      topic: "Live Shopify hydration failed",
      severity: "high",
      explanation: input.warning,
      recommendedAction: "Fix live Shopify connection/scopes, then run Sync Now.",
    },
  ];

  const readiness = buildShopifyAgenticReadinessScore({
    mcpDiagnostics: buildMockShopifyMcpDiagnostics({
      storeDomain: input.storeDomain,
      statusByEndpoint: {
        storefront_mcp: "needs_credentials",
        storefront_ucp_mcp: "not_configured",
      },
    }),
    products: productFacts,
    knowledgeBaseSummary,
    policyCoverage,
    trustSignals,
    testQueries,
    semanticGaps,
  });

  const entitySourceProvenance = input.products.map((product) =>
    buildShopifyEntitySourceProvenance({
      entityType: "product",
      source: "fallback_snapshot",
      fetchedAt: input.importState.lastImportAt,
      storeDomain: input.storeDomain,
      rawId: product.id,
      connectionId: "shopify_admin",
    })
  );

  return {
    ...baseUnavailableState({
      storeDomain: input.storeDomain,
      shopifyStatus: input.shopifyStatus,
      openAiStatus: input.openAiStatus,
      serpApiStatus: input.serpApiStatus,
      importState: input.importState,
      demoMode: false,
      sourceWarnings: [input.warning],
      sourceErrors: [],
    }),
    environmentLabel: "Fallback snapshot",
    modeLabel: "Fallback snapshot (live hydration failed)",
    workspaceSource: "fallback_snapshot",
    workspaceSourceLabel: sourceLabel("fallback_snapshot"),
    hydrationMode: "fallback",
    mockModeEnabled: false,
    mockFallbackActive: true,
    products: productFacts,
    entitySourceProvenance,
    catalogCounts: {
      products: productFacts.length,
      collections: 0,
      pages: 0,
      blogArticles: 0,
      policies: 0,
    },
    readiness,
    nextBestActions: buildShopifyNextBestActions({
      readiness,
      knowledgeBaseGaps: [],
      semanticGaps,
      testQueries,
    }),
  };
}

export async function buildShopifyAgenticWorkspaceStateForUser(
  options: WorkspaceOptions
): Promise<ShopifyAgenticWorkspaceState> {
  const demoMode = options.demoMode === true;

  if (demoMode) {
    const demoState = buildShopifyAgenticDemoWorkspaceState();
    return {
      ...demoState,
      modeLabel: "Demo data (explicit mode)",
      environmentLabel: "Demo mode",
      workspaceSource: "demo",
      workspaceSourceLabel: sourceLabel("demo"),
      hydrationMode: "demo",
      mockModeEnabled: true,
      mockFallbackActive: false,
    };
  }

  if (!options.userId) {
    return baseUnavailableState({
      storeDomain: "",
      shopifyStatus: disconnectedShopifyStatus(),
      openAiStatus: disconnectedOpenAiStatus(),
      serpApiStatus: disconnectedSerpApiStatus(),
      importState: emptyImportState(),
      demoMode: false,
      sourceWarnings: ["Sign in to access live Shopify workspace data."],
      sourceErrors: [],
    });
  }

  const [shopifyStatus, openAiStatus, serpApiStatus, importState] = await Promise.all([
    getShopifyConnectionStatusForUser(options.userId).catch(() => disconnectedShopifyStatus()),
    getShopifyOpenAiConnectionStatusForUser(options.userId).catch(() => disconnectedOpenAiStatus()),
    getShopifySerpApiConnectionStatusForUser(options.userId).catch(() => disconnectedSerpApiStatus()),
    getShopifyImportStateForUser(options.userId).catch(() => emptyImportState()),
  ]);

  const storeDomain = shopifyStatus.storeDomain || "";

  if (!shopifyStatus.connected || !storeDomain) {
    return baseUnavailableState({
      storeDomain,
      shopifyStatus,
      openAiStatus,
      serpApiStatus,
      importState,
      demoMode: false,
      sourceWarnings: ["Connect Shopify Admin API and run Sync Now to hydrate live workspace data."],
      sourceErrors: [],
    });
  }

  try {
    const live = await hydrateShopifyLiveWorkspaceForUser({
      userId: options.userId,
      productsFirst: 120,
      collectionsFirst: 80,
      pagesFirst: 50,
      blogsFirst: 20,
      articlesFirst: 20,
    });

    return buildLiveState({
      live,
      importState,
      shopifyStatus,
      openAiStatus,
      serpApiStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopify live hydration failed.";
    const fallbackProducts = await listShopifyProductsForUser(options.userId).catch(() => []);
    if (fallbackProducts.length > 0) {
      return buildFallbackState({
        products: fallbackProducts,
        storeDomain,
        shopifyStatus,
        openAiStatus,
        serpApiStatus,
        importState,
        warning: message,
      });
    }

    return baseUnavailableState({
      storeDomain,
      shopifyStatus,
      openAiStatus,
      serpApiStatus,
      importState,
      demoMode: false,
      sourceWarnings: [],
      sourceErrors: [message],
    });
  }
}
