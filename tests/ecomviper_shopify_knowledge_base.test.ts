import { describe, expect, it } from "vitest";
import { evaluateShopifyAgenticPromptMatch } from "@/lib/ecomviper/shopify/shopify-agentic-test-queries";
import { evaluateShopifyKnowledgeBaseReadiness } from "@/lib/ecomviper/shopify/shopify-knowledge-base-readiness";
import type {
  ShopifyPolicyCoverage,
  ShopifyProductAgenticFact,
  ShopifyTrustSignal,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";

const policyCoverage: ShopifyPolicyCoverage[] = [
  {
    id: "policy_shipping",
    policyType: "shipping",
    title: "Shipping",
    available: true,
    summary: "Shipping details available.",
  },
  {
    id: "policy_wholesale",
    policyType: "wholesale",
    title: "Wholesale",
    available: false,
    summary: "Wholesale policy missing.",
  },
];

const trustSignals: ShopifyTrustSignal[] = [
  {
    id: "support_email",
    label: "Support",
    value: "support@opanutrition.com",
    available: true,
    impact: "high",
  },
];

const products: ShopifyProductAgenticFact[] = [
  {
    id: "product_hydration",
    title: "OPA Hydration Support",
    category: "hydration / electrolytes",
    productFactsReadiness: 75,
    titleDescriptionReadiness: 72,
    imageAltTextReadiness: 68,
    schemaMetafieldReadiness: 70,
    productFaqReadiness: 62,
    agenticReferralNotes: "Improve fasting query guidance.",
  },
];

describe("Shopify knowledge base readiness", () => {
  it("flags missing answers as knowledge base gaps", () => {
    const readiness = evaluateShopifyKnowledgeBaseReadiness({
      questions: [
        {
          id: "kb_missing",
          category: "wholesale",
          question: "Do you offer wholesale pricing?",
          currentAnswer: "",
        },
        {
          id: "kb_partial",
          category: "support",
          question: "How do I contact support?",
          currentAnswer: "Email support.",
        },
      ],
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

    expect(readiness.questions.find((question) => question.id === "kb_missing")?.coverageStatus).toBe("missing");
    expect(readiness.gaps.length).toBeGreaterThan(0);
    expect(readiness.gaps.some((gap) => gap.questionId === "kb_missing")).toBe(true);
  });

  it("evaluates prompt-match queries with matched/partial/gap statuses", () => {
    const readiness = evaluateShopifyKnowledgeBaseReadiness({
      questions: [
        {
          id: "kb_support",
          category: "support",
          question: "How do I contact support?",
          currentAnswer: "Email support@opanutrition.com and include your order details for quick support response.",
        },
        {
          id: "kb_marketplace",
          category: "marketplace_availability",
          question: "Can I buy OPA Nutrition on Walmart or eBay?",
          currentAnswer: "",
        },
      ],
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

    const matches = evaluateShopifyAgenticPromptMatch({
      knowledgeBaseQuestions: readiness.questions,
      policies: policyCoverage,
      trustSignals,
      products,
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((query) => query.status === "matched" || query.status === "partial")).toBe(true);
    expect(matches.some((query) => query.status === "gap")).toBe(true);
  });
});
