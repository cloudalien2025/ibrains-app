import type {
  ShopifyAgenticTestQuery,
  ShopifyKnowledgeBaseQuestion,
  ShopifyPolicyCoverage,
  ShopifyProductAgenticFact,
  ShopifyTrustSignal,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface DefaultTestQueryInput {
  id: string;
  query: string;
  intent: string;
  expectedCategory: ShopifyAgenticTestQuery["expectedCategory"];
}

const DEFAULT_TEST_QUERIES: DefaultTestQueryInput[] = [
  {
    id: "query_fasting_support",
    query: "What supplements support intermittent fasting?",
    intent: "product_discovery",
    expectedCategory: "product_guidance",
  },
  {
    id: "query_shipping_international",
    query: "Does OPA Nutrition ship internationally?",
    intent: "shipping_policy",
    expectedCategory: "international",
  },
  {
    id: "query_hydration_fasting",
    query: "Which OPA product supports hydration during fasting?",
    intent: "product_guidance",
    expectedCategory: "product_guidance",
  },
  {
    id: "query_wholesale",
    query: "Do you offer wholesale pricing?",
    intent: "wholesale",
    expectedCategory: "wholesale",
  },
  {
    id: "query_marketplace_availability",
    query: "Can I buy OPA Nutrition on Walmart or eBay?",
    intent: "channel_availability",
    expectedCategory: "marketplace_availability",
  },
  {
    id: "query_bundle_guidance",
    query: "What is the best OPA Nutrition bundle for fasting?",
    intent: "bundle_guidance",
    expectedCategory: "product_guidance",
  },
  {
    id: "query_support",
    query: "How do I contact support?",
    intent: "support",
    expectedCategory: "support",
  },
  {
    id: "query_fda_disclaimer",
    query: "Are these products intended to diagnose, treat, cure, or prevent disease?",
    intent: "supplement_safety",
    expectedCategory: "supplement_safety",
  },
];

function containsText(value: string, fragment: string): boolean {
  return value.toLowerCase().includes(fragment.toLowerCase());
}

function scoreCategoryMatch(input: {
  query: string;
  category: ShopifyKnowledgeBaseQuestion["category"];
}): number {
  const { query, category } = input;
  if (category === "product_guidance") {
    return containsText(query, "supplement") || containsText(query, "product") ? 80 : 40;
  }
  if (category === "international") {
    return containsText(query, "international") || containsText(query, "ship") ? 92 : 20;
  }
  if (category === "wholesale") {
    return containsText(query, "wholesale") || containsText(query, "faire") ? 94 : 20;
  }
  if (category === "support") {
    return containsText(query, "support") || containsText(query, "contact") ? 95 : 15;
  }
  if (category === "marketplace_availability") {
    return containsText(query, "walmart") || containsText(query, "ebay") ? 95 : 20;
  }
  if (category === "supplement_safety") {
    return containsText(query, "diagnose") || containsText(query, "treat") ? 98 : 25;
  }
  if (category === "shipping") {
    return containsText(query, "ship") ? 85 : 25;
  }
  if (category === "returns") {
    return containsText(query, "return") ? 85 : 20;
  }
  return 20;
}

function bestKnowledgeBaseMatch(
  query: string,
  questions: ShopifyKnowledgeBaseQuestion[]
): ShopifyKnowledgeBaseQuestion | null {
  let best: ShopifyKnowledgeBaseQuestion | null = null;
  let bestScore = -1;

  for (const question of questions) {
    const score = scoreCategoryMatch({ query, category: question.category });
    if (score > bestScore) {
      best = question;
      bestScore = score;
    }
  }

  return best;
}

function trustSignalHint(query: string, trustSignals: ShopifyTrustSignal[]): string {
  if (containsText(query, "support")) {
    const supportSignal = trustSignals.find((signal) => signal.id === "support_email");
    return supportSignal?.value ?? "Support contact unavailable";
  }
  if (containsText(query, "international")) {
    const shippingSignal = trustSignals.find((signal) => signal.id === "international_shipping");
    return shippingSignal?.value ?? "International shipping coverage unavailable";
  }
  return "";
}

function policyHint(query: string, policies: ShopifyPolicyCoverage[]): string {
  if (containsText(query, "ship")) {
    const shipping = policies.find((policy) => policy.policyType === "shipping");
    return shipping?.summary ?? "Shipping policy unavailable";
  }
  if (containsText(query, "wholesale")) {
    const wholesale = policies.find((policy) => policy.policyType === "wholesale");
    return wholesale?.summary ?? "Wholesale policy unavailable";
  }
  return "";
}

function productHint(query: string, products: ShopifyProductAgenticFact[]): string {
  if (containsText(query, "hydration") || containsText(query, "fasting")) {
    const hydrationProduct = products.find((product) => containsText(product.category, "hydration"));
    return hydrationProduct?.title ?? "No hydration-focused product mapped";
  }
  return products[0]?.title ?? "No product match";
}

export function buildDefaultShopifyAgenticTestQueries(): DefaultTestQueryInput[] {
  return DEFAULT_TEST_QUERIES.map((query) => ({ ...query }));
}

export function evaluateShopifyAgenticPromptMatch(input: {
  queries?: DefaultTestQueryInput[];
  knowledgeBaseQuestions: ShopifyKnowledgeBaseQuestion[];
  policies: ShopifyPolicyCoverage[];
  trustSignals: ShopifyTrustSignal[];
  products: ShopifyProductAgenticFact[];
}): ShopifyAgenticTestQuery[] {
  const queries = input.queries ?? buildDefaultShopifyAgenticTestQueries();

  return queries.map((query) => {
    const matchedKnowledgeBaseQuestion = bestKnowledgeBaseMatch(query.query, input.knowledgeBaseQuestions);

    const confidenceFromKnowledgeBase = matchedKnowledgeBaseQuestion
      ? scoreCategoryMatch({ query: query.query, category: matchedKnowledgeBaseQuestion.category })
      : 0;

    const additionalHints = [
      trustSignalHint(query.query, input.trustSignals),
      policyHint(query.query, input.policies),
      productHint(query.query, input.products),
    ]
      .map((entry) => entry.trim())
      .filter(Boolean);

    const confidence = Math.max(0, Math.min(100, confidenceFromKnowledgeBase));

    const status: ShopifyAgenticTestQuery["status"] =
      confidence >= 80
        ? matchedKnowledgeBaseQuestion?.coverageStatus === "covered"
          ? "matched"
          : "partial"
        : "gap";

    const matchedResource = matchedKnowledgeBaseQuestion
      ? `${matchedKnowledgeBaseQuestion.category}: ${matchedKnowledgeBaseQuestion.question}`
      : "No matched resource";

    const missingAnswerWarning =
      status === "matched"
        ? ""
        : matchedKnowledgeBaseQuestion
          ? "Knowledge Base answer is incomplete or missing detail for this query."
          : "No Knowledge Base resource currently addresses this query.";

    const suggestedKnowledgeBaseAnswer =
      matchedKnowledgeBaseQuestion?.generatedAnswer || additionalHints.join(" | ") || "Create a new KB answer.";

    return {
      id: query.id,
      query: query.query,
      intent: query.intent,
      expectedCategory: query.expectedCategory,
      matchedResource,
      matchConfidence: confidence,
      status,
      missingAnswerWarning,
      suggestedKnowledgeBaseAnswer,
    };
  });
}
