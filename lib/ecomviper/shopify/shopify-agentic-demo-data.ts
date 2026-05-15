import type {
  ShopifyAgenticWorkspaceState,
  ShopifyKnowledgeBaseQuestion,
  ShopifyPolicyCoverage,
  ShopifyProductAgenticFact,
  ShopifySemanticGap,
  ShopifyTrustSignal,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";
import { buildShopifyAgenticReadinessScore } from "@/lib/ecomviper/shopify/shopify-agentic-readiness";
import { buildShopifyNextBestActions } from "@/lib/ecomviper/shopify/shopify-ai-referral-opportunities";
import { evaluateShopifyAgenticPromptMatch } from "@/lib/ecomviper/shopify/shopify-agentic-test-queries";
import { evaluateShopifyKnowledgeBaseReadiness } from "@/lib/ecomviper/shopify/shopify-knowledge-base-readiness";
import { buildMockShopifyMcpDiagnostics, buildShopifyStorefrontMcpEndpoints } from "@/lib/ecomviper/shopify/shopify-storefront-mcp-diagnostics";

function demoProducts(): ShopifyProductAgenticFact[] {
  return [
    {
      id: "shopify_product_hydration_electrolytes",
      title: "OPA Hydration Electrolyte Support",
      handle: "opa-hydration-electrolyte-support",
      editorIdentifier: "opa-hydration-electrolyte-support",
      editorLinkEnabled: true,
      editorLinkDisabledReason: null,
      category: "hydration / electrolytes",
      sourceLabel: "Demo data",
      productFactsReadiness: 78,
      titleDescriptionReadiness: 74,
      imageAltTextReadiness: 62,
      schemaMetafieldReadiness: 66,
      productFaqReadiness: 70,
      agenticReferralNotes: "Improve fasting hydration intent coverage with stronger bundle recommendations.",
    },
    {
      id: "shopify_product_metabolism_support",
      title: "OPA Metabolism Daily Support",
      handle: "opa-metabolism-daily-support",
      editorIdentifier: "opa-metabolism-daily-support",
      editorLinkEnabled: true,
      editorLinkDisabledReason: null,
      category: "metabolism support",
      sourceLabel: "Demo data",
      productFactsReadiness: 72,
      titleDescriptionReadiness: 69,
      imageAltTextReadiness: 58,
      schemaMetafieldReadiness: 61,
      productFaqReadiness: 64,
      agenticReferralNotes: "Strengthen schema/metafields for ingredient and serving-size retrieval.",
    },
    {
      id: "shopify_product_sleep_quality",
      title: "OPA Sleep Quality Support",
      handle: "opa-sleep-quality-support",
      editorIdentifier: "opa-sleep-quality-support",
      editorLinkEnabled: true,
      editorLinkDisabledReason: null,
      category: "sleep quality",
      sourceLabel: "Demo data",
      productFactsReadiness: 76,
      titleDescriptionReadiness: 73,
      imageAltTextReadiness: 71,
      schemaMetafieldReadiness: 68,
      productFaqReadiness: 60,
      agenticReferralNotes: "Add compliance-safe sleep FAQ and support-channel links.",
    },
  ];
}

function demoPolicyCoverage(): ShopifyPolicyCoverage[] {
  return [
    {
      id: "policy_shipping",
      policyType: "shipping",
      title: "Shipping Policy",
      available: true,
      summary: "Standard and expedited shipping options are described with checkout estimates.",
    },
    {
      id: "policy_returns",
      policyType: "returns",
      title: "Returns Policy",
      available: true,
      summary: "Returns are reviewed by support with confirmation steps.",
    },
    {
      id: "policy_wholesale",
      policyType: "wholesale",
      title: "Wholesale Policy",
      available: false,
      summary: "Wholesale process details are incomplete for AI-facing answers.",
    },
    {
      id: "policy_support",
      policyType: "support",
      title: "Support Policy",
      available: true,
      summary: "Support is available at support@opanutrition.com.",
    },
    {
      id: "policy_international",
      policyType: "international",
      title: "International Shipping",
      available: true,
      summary: "International shipping is supported for selected regions.",
    },
    {
      id: "policy_marketplaces",
      policyType: "marketplace_availability",
      title: "Marketplace Availability",
      available: false,
      summary: "Marketplace coverage (Shopify/Walmart/eBay) lacks a consolidated answer.",
    },
  ];
}

function demoTrustSignals(): ShopifyTrustSignal[] {
  return [
    {
      id: "brand_name",
      label: "Brand",
      value: "OPA Nutrition",
      available: true,
      impact: "high",
    },
    {
      id: "support_email",
      label: "Support Email",
      value: "support@opanutrition.com",
      available: true,
      impact: "high",
    },
    {
      id: "international_shipping",
      label: "International Shipping",
      value: "Yes",
      available: true,
      impact: "high",
    },
    {
      id: "wholesale_faire",
      label: "Wholesale",
      value: "Available via Faire",
      available: true,
      impact: "medium",
    },
    {
      id: "marketplace_availability",
      label: "Marketplace Availability",
      value: "Shopify, Walmart, eBay",
      available: true,
      impact: "medium",
    },
    {
      id: "secure_checkout",
      label: "Secure Checkout",
      value: "Shopify checkout security enabled",
      available: true,
      impact: "high",
    },
    {
      id: "return_support_policies",
      label: "Return + Support Policies",
      value: "Published",
      available: true,
      impact: "medium",
    },
  ];
}

function demoKnowledgeBaseQuestions(): Array<
  Pick<ShopifyKnowledgeBaseQuestion, "id" | "category" | "question" | "currentAnswer">
> {
  return [
    {
      id: "kb_shipping_international",
      category: "international",
      question: "Does OPA Nutrition ship internationally?",
      currentAnswer: "We ship to many countries. Reach support if your destination is not listed at checkout.",
    },
    {
      id: "kb_hydration_fasting",
      category: "product_guidance",
      question: "Which OPA product supports hydration during fasting?",
      currentAnswer: "",
    },
    {
      id: "kb_wholesale",
      category: "wholesale",
      question: "Do you offer wholesale pricing?",
      currentAnswer: "Wholesale is available via approved partners.",
    },
    {
      id: "kb_marketplaces",
      category: "marketplace_availability",
      question: "Can I buy OPA products on Walmart or eBay?",
      currentAnswer: "",
    },
    {
      id: "kb_support",
      category: "support",
      question: "How do I contact support?",
      currentAnswer: "Email support@opanutrition.com and our team will help with your order.",
    },
    {
      id: "kb_supplement_safety",
      category: "supplement_safety",
      question: "Are these products intended to diagnose, treat, cure, or prevent disease?",
      currentAnswer:
        "Our supplement content focuses on daily wellness support and does not include disease claims.",
    },
    {
      id: "kb_bundle",
      category: "product_guidance",
      question: "What is the best OPA Nutrition bundle for fasting?",
      currentAnswer: "",
    },
  ];
}

function demoSemanticGaps(): ShopifySemanticGap[] {
  return [
    {
      id: "semantic_gap_bundle_guidance",
      topic: "Missing bundle guidance for fasting goals",
      severity: "high",
      explanation: "Long-tail bundle questions do not map to a direct KB answer.",
      recommendedAction: "Create a KB answer and product recommendation lane for fasting bundles.",
    },
    {
      id: "semantic_gap_marketplace_availability",
      topic: "Marketplace availability answer depth",
      severity: "medium",
      explanation: "Cross-channel purchase availability lacks concise AI-ready copy.",
      recommendedAction: "Add a dedicated availability FAQ covering Shopify, Walmart, and eBay.",
    },
    {
      id: "semantic_gap_comparison_intent",
      topic: "Limited product-comparison guidance",
      severity: "medium",
      explanation: "Comparison prompts often produce partial answer matches.",
      recommendedAction: "Add side-by-side product comparison guidance for top intents.",
    },
  ];
}

export function buildShopifyAgenticDemoWorkspaceState(): ShopifyAgenticWorkspaceState {
  const storeDomain = "opanutrition.myshopify.com";
  const nowIso = new Date().toISOString();
  const storefrontMcpEndpoints = buildShopifyStorefrontMcpEndpoints(storeDomain);
  const mcpDiagnostics = buildMockShopifyMcpDiagnostics({
    storeDomain,
    statusByEndpoint: {
      storefront_mcp: "mock_ready",
      storefront_ucp_mcp: "needs_credentials",
    },
  });

  const products = demoProducts();
  const policyCoverage = demoPolicyCoverage();
  const trustSignals = demoTrustSignals();

  const knowledgeBaseReadiness = evaluateShopifyKnowledgeBaseReadiness({
    questions: demoKnowledgeBaseQuestions(),
    policyCoverage,
    trustSignals,
    storeContext: {
      storeName: "OPA Nutrition",
      supportEmail: "support@opanutrition.com",
      shipsInternationally: true,
      wholesaleAvailable: true,
      marketplaces: ["Shopify", "Walmart", "eBay"],
    },
  });

  const semanticGaps = demoSemanticGaps();

  const testQueries = evaluateShopifyAgenticPromptMatch({
    knowledgeBaseQuestions: knowledgeBaseReadiness.questions,
    policies: policyCoverage,
    trustSignals,
    products,
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
    storeName: "OPA Nutrition",
    storeDomain,
    environmentLabel: "Demo mode",
    storeLabel: "opanutrition.myshopify.com",
    modeLabel: "Demo data (explicit mode)",
    workspaceSource: "demo",
    workspaceSourceLabel: "Demo data",
    hydrationMode: "demo",
    mockModeEnabled: true,
    mockFallbackActive: false,
    sourceWarnings: [],
    sourceErrors: [],
    lastSyncedAt: null,
    lastVisibilityScanAt: null,
    connectionStatus: {
      shopify: {
        connected: false,
        mode: "demo",
        credentialSource: "demo",
        maskedCredential: "Demo",
        lastTestedAt: null,
        lastSyncAt: null,
        lastError: null,
        statusLabel: "Demo",
      },
      openai: {
        connected: false,
        mode: "unavailable",
        credentialSource: "none",
        maskedCredential: "Not configured",
        lastTestedAt: null,
        lastError: null,
        statusLabel: "Not connected",
      },
      serpapi: {
        connected: false,
        mode: "unavailable",
        credentialSource: "none",
        maskedCredential: "Not configured",
        lastTestedAt: null,
        lastScanAt: null,
        lastError: null,
        statusLabel: "Not connected",
      },
    },
    entitySourceProvenance: [
      {
        entityType: "shop",
        source: "demo",
        fetchedAt: nowIso,
        storeDomain,
        rawId: "demo_shop",
        connectionId: null,
      },
    ],
    catalogCounts: {
      products: products.length,
      collections: 0,
      pages: 0,
      blogArticles: 0,
      policies: policyCoverage.length,
    },
    storefrontMcpEndpoints,
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
