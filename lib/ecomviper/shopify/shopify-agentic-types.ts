export type ShopifyWorkspaceLaneId =
  | "command-center"
  | "products"
  | "knowledge-base"
  | "prompt-match"
  | "trust-signals"
  | "semantic-gaps"
  | "product-opportunities"
  | "marketplace-health"
  | "settings";

export interface ShopifyWorkspaceLane {
  id: ShopifyWorkspaceLaneId;
  label: string;
}

export type ShopifyMcpEndpointKind = "storefront_mcp" | "storefront_ucp_mcp";

export interface ShopifyStorefrontMcpEndpoint {
  id: ShopifyMcpEndpointKind;
  label: string;
  url: string;
}

export type ShopifyMcpDiagnosticStatus =
  | "not_configured"
  | "mock_ready"
  | "reachable"
  | "failed"
  | "needs_credentials";

export interface ShopifyMcpDiagnosticResult {
  endpoint: ShopifyStorefrontMcpEndpoint;
  status: ShopifyMcpDiagnosticStatus;
  checkedAt: string;
  message: string;
  latencyMs: number | null;
  source: "mock" | "live" | "disabled";
}

export type ShopifyKnowledgeBaseCategory =
  | "shipping"
  | "returns"
  | "wholesale"
  | "support"
  | "product_guidance"
  | "supplement_safety"
  | "international"
  | "marketplace_availability";

export type ShopifyKnowledgeBaseCoverageStatus = "covered" | "partial" | "missing";

export interface ShopifyKnowledgeBaseQuestion {
  id: string;
  category: ShopifyKnowledgeBaseCategory;
  question: string;
  currentAnswer: string;
  generatedAnswer: string;
  copyReadyAnswer: string;
  coverageStatus: ShopifyKnowledgeBaseCoverageStatus;
  gapReason: string;
}

export interface ShopifyKnowledgeBaseGap {
  id: string;
  questionId: string;
  category: ShopifyKnowledgeBaseCategory;
  question: string;
  reason: string;
  severity: "high" | "medium" | "low";
  recommendedAction: string;
}

export interface ShopifyKnowledgeBaseReadinessSummary {
  coveragePercent: number;
  coveredCount: number;
  partialCount: number;
  missingCount: number;
  missingBuyerQuestions: number;
  policyGapCount: number;
  brandVoiceGuardrails: string[];
  queryLogPlaceholder: string[];
  generatedFaqBundle: string;
}

export interface ShopifyAgenticTestQuery {
  id: string;
  query: string;
  intent: string;
  expectedCategory: ShopifyKnowledgeBaseCategory;
  matchedResource: string;
  matchConfidence: number;
  status: "matched" | "partial" | "gap";
  missingAnswerWarning: string;
  suggestedKnowledgeBaseAnswer: string;
}

export interface ShopifyPolicyCoverage {
  id: string;
  policyType: ShopifyKnowledgeBaseCategory;
  title: string;
  available: boolean;
  summary: string;
}

export interface ShopifyTrustSignal {
  id: string;
  label: string;
  value: string;
  available: boolean;
  impact: "high" | "medium" | "low";
}

export interface ShopifyProductAgenticFact {
  id: string;
  title: string;
  category: string;
  productFactsReadiness: number;
  titleDescriptionReadiness: number;
  imageAltTextReadiness: number;
  schemaMetafieldReadiness: number;
  productFaqReadiness: number;
  agenticReferralNotes: string;
}

export interface ShopifySemanticGap {
  id: string;
  topic: string;
  severity: "high" | "medium" | "low";
  explanation: string;
  recommendedAction: string;
}

export type ShopifyReadinessStatus = "excellent" | "good" | "needs_work" | "critical";

export type ShopifyReadinessDimensionKey =
  | "storefrontMcpReadiness"
  | "ucpCatalogReadiness"
  | "productFactsReadiness"
  | "knowledgeBaseCoverage"
  | "policyCoverage"
  | "faqAnswerQuality"
  | "semanticPromptMatch"
  | "trustSignalCoverage"
  | "imageAltTextReadiness"
  | "schemaMetafieldReadiness"
  | "supplementComplianceSafety"
  | "aiReferralReadiness";

export interface ShopifyReadinessDimensionScore {
  key: ShopifyReadinessDimensionKey;
  label: string;
  value: number;
  status: ShopifyReadinessStatus;
  explanation: string;
  recommendedActions: string[];
}

export interface ShopifyAgenticReadinessScore {
  overallValue: number;
  overallLabel: string;
  overallStatus: ShopifyReadinessStatus;
  dimensions: Record<ShopifyReadinessDimensionKey, ShopifyReadinessDimensionScore>;
  topIssues: string[];
}

export interface ShopifyNextBestAction {
  id: string;
  lane: ShopifyWorkspaceLaneId;
  title: string;
  impact: "high" | "medium" | "low";
  rationale: string;
  effort: "low" | "medium" | "high";
  priorityScore: number;
}

export interface ShopifySupplementComplianceResult {
  safe: boolean;
  blockedPhrases: string[];
  safeAlternatives: string[];
  disclaimerIncluded: boolean;
  normalizedText: string;
}

export interface ShopifyAgenticWorkspaceState {
  storeName: string;
  storeDomain: string;
  environmentLabel: string;
  storeLabel: string;
  modeLabel: string;
  storefrontMcpEndpoints: ShopifyStorefrontMcpEndpoint[];
  mcpDiagnostics: ShopifyMcpDiagnosticResult[];
  products: ShopifyProductAgenticFact[];
  policyCoverage: ShopifyPolicyCoverage[];
  trustSignals: ShopifyTrustSignal[];
  knowledgeBaseQuestions: ShopifyKnowledgeBaseQuestion[];
  knowledgeBaseGaps: ShopifyKnowledgeBaseGap[];
  knowledgeBaseSummary: ShopifyKnowledgeBaseReadinessSummary;
  testQueries: ShopifyAgenticTestQuery[];
  semanticGaps: ShopifySemanticGap[];
  readiness: ShopifyAgenticReadinessScore;
  nextBestActions: ShopifyNextBestAction[];
}
