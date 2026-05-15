import type {
  ShopifyAgenticReadinessScore,
  ShopifyAgenticTestQuery,
  ShopifyKnowledgeBaseGap,
  ShopifyNextBestAction,
  ShopifySemanticGap,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";

function impactScore(impact: ShopifyNextBestAction["impact"]): number {
  if (impact === "high") return 30;
  if (impact === "medium") return 18;
  return 10;
}

function effortPenalty(effort: ShopifyNextBestAction["effort"]): number {
  if (effort === "low") return 4;
  if (effort === "medium") return 10;
  return 16;
}

function scoredAction(action: Omit<ShopifyNextBestAction, "priorityScore">): ShopifyNextBestAction {
  const base = impactScore(action.impact);
  const penalty = effortPenalty(action.effort);
  return {
    ...action,
    priorityScore: Math.max(1, base - penalty + 20),
  };
}

export function buildShopifyNextBestActions(input: {
  readiness: ShopifyAgenticReadinessScore;
  knowledgeBaseGaps: ShopifyKnowledgeBaseGap[];
  semanticGaps: ShopifySemanticGap[];
  testQueries: ShopifyAgenticTestQuery[];
}): ShopifyNextBestAction[] {
  const missingSafetyQuery = input.testQueries.find((query) => query.id === "query_fda_disclaimer" && query.status !== "matched");
  const highSeverityKnowledgeGap = input.knowledgeBaseGaps.find((gap) => gap.severity === "high");
  const highSemanticGap = input.semanticGaps.find((gap) => gap.severity === "high");

  const actions: ShopifyNextBestAction[] = [
    scoredAction({
      id: "action_kb_safety",
      lane: "knowledge-base",
      title: "Publish supplement safety FAQ in Shopify Knowledge Base",
      impact: missingSafetyQuery ? "high" : "medium",
      effort: "low",
      rationale:
        "Ensure AI agents answer supplement-safety questions with compliant wording and FDA disclaimer.",
    }),
    scoredAction({
      id: "action_mcp_connection",
      lane: "command-center",
      title: "Validate Storefront MCP endpoint configuration",
      impact:
        input.readiness.dimensions.storefrontMcpReadiness.status === "critical" ? "high" : "medium",
      effort: "medium",
      rationale:
        "A healthy MCP path improves agentic product/policy retrieval quality.",
    }),
    scoredAction({
      id: "action_policy_coverage",
      lane: "knowledge-base",
      title: "Close shipping, wholesale, and support policy gaps",
      impact: highSeverityKnowledgeGap ? "high" : "medium",
      effort: "medium",
      rationale: highSeverityKnowledgeGap
        ? highSeverityKnowledgeGap.reason
        : "Policy answers reduce agent uncertainty for conversion-critical questions.",
    }),
    scoredAction({
      id: "action_prompt_match",
      lane: "prompt-match",
      title: "Improve prompt-match for long-tail buyer queries",
      impact: highSemanticGap ? "high" : "medium",
      effort: "medium",
      rationale: highSemanticGap
        ? highSemanticGap.explanation
        : "Long-tail intent coverage increases referral quality from AI agents.",
    }),
    scoredAction({
      id: "action_schema_alt_text",
      lane: "products",
      title: "Raise product schema/metafield and alt-text readiness",
      impact:
        input.readiness.dimensions.imageAltTextReadiness.value < 70 ||
        input.readiness.dimensions.schemaMetafieldReadiness.value < 70
          ? "high"
          : "medium",
      effort: "high",
      rationale:
        "Structured product facts and image semantics improve discoverability and ranking confidence.",
    }),
  ];

  return [...actions].sort((left, right) => right.priorityScore - left.priorityScore);
}
