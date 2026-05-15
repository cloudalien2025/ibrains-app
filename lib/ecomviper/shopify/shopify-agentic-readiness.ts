import type {
  ShopifyAgenticReadinessScore,
  ShopifyAgenticTestQuery,
  ShopifyKnowledgeBaseReadinessSummary,
  ShopifyMcpDiagnosticResult,
  ShopifyPolicyCoverage,
  ShopifyProductAgenticFact,
  ShopifyReadinessDimensionKey,
  ShopifyReadinessDimensionScore,
  ShopifyReadinessStatus,
  ShopifySemanticGap,
  ShopifyTrustSignal,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyReadinessInput {
  mcpDiagnostics: ShopifyMcpDiagnosticResult[];
  products: ShopifyProductAgenticFact[];
  knowledgeBaseSummary: ShopifyKnowledgeBaseReadinessSummary;
  policyCoverage: ShopifyPolicyCoverage[];
  trustSignals: ShopifyTrustSignal[];
  testQueries: ShopifyAgenticTestQuery[];
  semanticGaps: ShopifySemanticGap[];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toStatus(value: number): ShopifyReadinessStatus {
  if (value >= 85) return "excellent";
  if (value >= 70) return "good";
  if (value >= 50) return "needs_work";
  return "critical";
}

function scoreFromMcpDiagnostics(diagnostics: ShopifyMcpDiagnosticResult[]): number {
  const mapping: Record<ShopifyMcpDiagnosticResult["status"], number> = {
    reachable: 100,
    mock_ready: 72,
    not_configured: 42,
    needs_credentials: 35,
    failed: 20,
  };

  return average(diagnostics.map((diagnostic) => mapping[diagnostic.status]));
}

function scoreFromCoverage(items: Array<{ available: boolean }>): number {
  if (!items.length) return 0;
  const availableCount = items.filter((item) => item.available).length;
  return Math.round((availableCount / items.length) * 100);
}

function scoreFromTestQueries(testQueries: ShopifyAgenticTestQuery[]): number {
  const mapped = testQueries.map((query) => {
    if (query.status === "matched") return query.matchConfidence;
    if (query.status === "partial") return Math.round(query.matchConfidence * 0.75);
    return Math.round(query.matchConfidence * 0.45);
  });
  return average(mapped);
}

function scoreFromSemanticGaps(semanticGaps: ShopifySemanticGap[]): number {
  if (!semanticGaps.length) return 88;

  const penalties = semanticGaps.map((gap) => {
    if (gap.severity === "high") return 18;
    if (gap.severity === "medium") return 12;
    return 6;
  });

  const penalty = average(penalties);
  return Math.max(10, 100 - penalty);
}

function dimensionScore(input: {
  key: ShopifyReadinessDimensionKey;
  label: string;
  value: number;
  explanation: string;
  recommendedActions: string[];
}): ShopifyReadinessDimensionScore {
  return {
    key: input.key,
    label: input.label,
    value: Math.max(0, Math.min(100, Math.round(input.value))),
    status: toStatus(input.value),
    explanation: input.explanation,
    recommendedActions: input.recommendedActions,
  };
}

export function buildShopifyAgenticReadinessScore(
  input: ShopifyReadinessInput
): ShopifyAgenticReadinessScore {
  const storefrontMcpReadinessValue = scoreFromMcpDiagnostics(input.mcpDiagnostics);
  const ucpCatalogReadinessValue = average(
    input.products.map((product) => product.titleDescriptionReadiness)
  );
  const productFactsReadinessValue = average(
    input.products.map((product) => product.productFactsReadiness)
  );
  const knowledgeBaseCoverageValue = input.knowledgeBaseSummary.coveragePercent;
  const policyCoverageValue = scoreFromCoverage(input.policyCoverage);
  const faqAnswerQualityValue = Math.max(
    10,
    Math.min(
      100,
      input.knowledgeBaseSummary.coveragePercent - input.knowledgeBaseSummary.missingCount * 6
    )
  );
  const semanticPromptMatchValue = scoreFromTestQueries(input.testQueries);
  const trustSignalCoverageValue = scoreFromCoverage(input.trustSignals);
  const imageAltTextReadinessValue = average(
    input.products.map((product) => product.imageAltTextReadiness)
  );
  const schemaMetafieldReadinessValue = average(
    input.products.map((product) => product.schemaMetafieldReadiness)
  );
  const supplementComplianceSafetyValue =
    input.testQueries.find((query) => query.id === "query_fda_disclaimer")?.status === "matched"
      ? 94
      : 66;
  const aiReferralReadinessValue = average([
    semanticPromptMatchValue,
    trustSignalCoverageValue,
    scoreFromSemanticGaps(input.semanticGaps),
    knowledgeBaseCoverageValue,
  ]);

  const dimensions: Record<ShopifyReadinessDimensionKey, ShopifyReadinessDimensionScore> = {
    storefrontMcpReadiness: dimensionScore({
      key: "storefrontMcpReadiness",
      label: "Storefront MCP Readiness",
      value: storefrontMcpReadinessValue,
      explanation:
        "Checks endpoint configuration and whether the workspace can safely simulate or reach MCP routes.",
      recommendedActions: [
        "Confirm /api/mcp and /api/ucp/mcp endpoint configuration.",
        "Keep mock diagnostics enabled until live credentials are approved.",
      ],
    }),
    ucpCatalogReadiness: dimensionScore({
      key: "ucpCatalogReadiness",
      label: "UCP Catalog Readiness",
      value: ucpCatalogReadinessValue,
      explanation:
        "Measures how complete product titles/descriptions are for agent-facing retrieval.",
      recommendedActions: [
        "Strengthen product titles and descriptions with category intent.",
      ],
    }),
    productFactsReadiness: dimensionScore({
      key: "productFactsReadiness",
      label: "Product Facts Readiness",
      value: productFactsReadinessValue,
      explanation: "Evaluates product-level fact completeness for AI answer grounding.",
      recommendedActions: [
        "Add product facts for usage context, ingredients, and support details.",
      ],
    }),
    knowledgeBaseCoverage: dimensionScore({
      key: "knowledgeBaseCoverage",
      label: "Knowledge Base Coverage",
      value: knowledgeBaseCoverageValue,
      explanation: "Tracks the share of FAQ/policy questions with complete answers.",
      recommendedActions: [
        "Fill missing Knowledge Base questions and tighten partial answers.",
      ],
    }),
    policyCoverage: dimensionScore({
      key: "policyCoverage",
      label: "Policy Coverage",
      value: policyCoverageValue,
      explanation: "Measures availability of shipping, returns, wholesale, and support policy answers.",
      recommendedActions: [
        "Publish missing policy summaries and keep them AI-answer friendly.",
      ],
    }),
    faqAnswerQuality: dimensionScore({
      key: "faqAnswerQuality",
      label: "FAQ Answer Quality",
      value: faqAnswerQualityValue,
      explanation: "Scores FAQ quality based on answer completeness and consistency.",
      recommendedActions: [
        "Expand short answers with clear resolution paths and boundaries.",
      ],
    }),
    semanticPromptMatch: dimensionScore({
      key: "semanticPromptMatch",
      label: "Semantic Prompt Match",
      value: semanticPromptMatchValue,
      explanation:
        "Assesses how often test buyer prompts match an existing product/policy/FAQ resource.",
      recommendedActions: [
        "Add targeted answers for low-confidence or gap query clusters.",
      ],
    }),
    trustSignalCoverage: dimensionScore({
      key: "trustSignalCoverage",
      label: "Trust Signal Coverage",
      value: trustSignalCoverageValue,
      explanation: "Checks visibility of support, shipping, wholesale, and secure checkout trust facts.",
      recommendedActions: [
        "Publish missing trust signals in Shopify and Knowledge Base content.",
      ],
    }),
    imageAltTextReadiness: dimensionScore({
      key: "imageAltTextReadiness",
      label: "Image Alt Text Readiness",
      value: imageAltTextReadinessValue,
      explanation: "Measures whether product images include descriptive alt text for agentic search.",
      recommendedActions: ["Expand alt text coverage for top conversion products."],
    }),
    schemaMetafieldReadiness: dimensionScore({
      key: "schemaMetafieldReadiness",
      label: "Schema + Metafield Readiness",
      value: schemaMetafieldReadinessValue,
      explanation: "Scores structured data support needed for robust AI understanding.",
      recommendedActions: [
        "Improve product schema and key metafield completeness by category.",
      ],
    }),
    supplementComplianceSafety: dimensionScore({
      key: "supplementComplianceSafety",
      label: "Supplement Compliance Safety",
      value: supplementComplianceSafetyValue,
      explanation:
        "Validates supplement-safe language and FDA disclaimer coverage for generated answers.",
      recommendedActions: [
        "Block disease/treatment language and keep structure/function wording.",
      ],
    }),
    aiReferralReadiness: dimensionScore({
      key: "aiReferralReadiness",
      label: "AI Referral Readiness",
      value: aiReferralReadinessValue,
      explanation:
        "Composite score estimating referral readiness across prompt match, trust signals, and KB quality.",
      recommendedActions: [
        "Prioritize high-impact gaps in KB coverage and product semantics.",
      ],
    }),
  };

  const overallValue = average(Object.values(dimensions).map((dimension) => dimension.value));
  const overallStatus = toStatus(overallValue);

  const topIssues = Object.values(dimensions)
    .filter((dimension) => dimension.status === "critical" || dimension.status === "needs_work")
    .sort((left, right) => left.value - right.value)
    .slice(0, 5)
    .map((dimension) => `${dimension.label}: ${dimension.explanation}`);

  return {
    overallValue,
    overallLabel: "Shopify Agentic Readiness",
    overallStatus,
    dimensions,
    topIssues,
  };
}
