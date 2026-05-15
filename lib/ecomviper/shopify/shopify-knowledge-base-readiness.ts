import type {
  ShopifyKnowledgeBaseGap,
  ShopifyKnowledgeBaseQuestion,
  ShopifyKnowledgeBaseReadinessSummary,
  ShopifyPolicyCoverage,
  ShopifyTrustSignal,
} from "@/lib/ecomviper/shopify/shopify-agentic-types";
import {
  SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER,
  buildSupplementSafeFaqBundle,
  supplementComplianceGuardrails,
} from "@/lib/ecomviper/shopify/shopify-supplement-compliance";

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function categoryTemplate(
  category: ShopifyKnowledgeBaseQuestion["category"],
  storeContext: {
    storeName: string;
    supportEmail: string;
    shipsInternationally: boolean;
    wholesaleAvailable: boolean;
    marketplaces: string[];
  }
): string {
  if (category === "shipping") {
    return `${storeContext.storeName} processes orders quickly and shares shipping updates at checkout. Reach ${storeContext.supportEmail} for shipping support.`;
  }
  if (category === "returns") {
    return `${storeContext.storeName} reviews return requests through support and confirms next steps by email.`;
  }
  if (category === "wholesale") {
    return storeContext.wholesaleAvailable
      ? `Wholesale is available through Faire and approved partner workflows. Contact ${storeContext.supportEmail} for wholesale onboarding.`
      : "Wholesale is currently not enabled.";
  }
  if (category === "support") {
    return `For support, email ${storeContext.supportEmail} and include your order details for faster resolution.`;
  }
  if (category === "international") {
    return storeContext.shipsInternationally
      ? `${storeContext.storeName} supports international shipping for eligible destinations and will confirm rates at checkout.`
      : `${storeContext.storeName} currently ships to domestic destinations only.`;
  }
  if (category === "marketplace_availability") {
    return `${storeContext.storeName} products are available on ${storeContext.marketplaces.join(", ")} when inventory is active on those channels.`;
  }
  if (category === "supplement_safety") {
    return `OPA supplement content uses structure/function language only: supports daily wellness, supports digestion, and supports metabolism. ${SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER}`;
  }

  return `${storeContext.storeName} product guidance focuses on ingredient facts, intended usage, and practical purchase guidance.`;
}

function assessCoverageStatus(
  question: ShopifyKnowledgeBaseQuestion
): ShopifyKnowledgeBaseQuestion["coverageStatus"] {
  const current = normalizeText(question.currentAnswer);
  if (!current) return "missing";
  if (current.length < 80) return "partial";
  return "covered";
}

function gapReason(question: ShopifyKnowledgeBaseQuestion): string {
  if (question.coverageStatus === "covered") return "";
  if (question.coverageStatus === "partial") {
    return "Current answer is too short for agentic query handling.";
  }
  return "Missing current answer in Shopify Knowledge Base.";
}

function toGap(
  question: ShopifyKnowledgeBaseQuestion,
  policyCoverage: ShopifyPolicyCoverage[]
): ShopifyKnowledgeBaseGap | null {
  if (question.coverageStatus === "covered") return null;

  const relatedPolicy = policyCoverage.find((policy) => policy.policyType === question.category);
  const policyMissing = relatedPolicy ? !relatedPolicy.available : false;

  return {
    id: `kb_gap_${question.id}`,
    questionId: question.id,
    category: question.category,
    question: question.question,
    reason: policyMissing
      ? `${question.gapReason} Related policy coverage is missing.`
      : question.gapReason,
    severity:
      question.coverageStatus === "missing" ? "high" : policyMissing ? "high" : "medium",
    recommendedAction: policyMissing
      ? "Publish a policy answer and sync a concise FAQ entry for this question."
      : "Generate and review a Shopify Knowledge Base answer for this question.",
  };
}

function buildQueryLogPlaceholder(): string[] {
  return [
    "Query log placeholder: buyer asked about international shipping.",
    "Query log placeholder: buyer asked about wholesale ordering.",
    "Query log placeholder: buyer asked about supplement safety language.",
  ];
}

export function evaluateShopifyKnowledgeBaseReadiness(input: {
  questions: Array<Pick<ShopifyKnowledgeBaseQuestion, "id" | "category" | "question" | "currentAnswer">>;
  policyCoverage: ShopifyPolicyCoverage[];
  trustSignals: ShopifyTrustSignal[];
  storeContext: {
    storeName: string;
    supportEmail: string;
    shipsInternationally: boolean;
    wholesaleAvailable: boolean;
    marketplaces: string[];
  };
}): {
  questions: ShopifyKnowledgeBaseQuestion[];
  gaps: ShopifyKnowledgeBaseGap[];
  summary: ShopifyKnowledgeBaseReadinessSummary;
} {
  const questions = input.questions.map((question) => {
    const generatedAnswer = categoryTemplate(question.category, input.storeContext);
    const currentAnswer = normalizeText(question.currentAnswer);
    const coverageStatus = assessCoverageStatus({
      ...question,
      currentAnswer,
      generatedAnswer,
      copyReadyAnswer: generatedAnswer,
      coverageStatus: "missing",
      gapReason: "",
    });

    const selectedAnswer = coverageStatus === "covered" ? currentAnswer : generatedAnswer;
    const copyReadyAnswer =
      question.category === "supplement_safety"
        ? buildSupplementSafeFaqBundle([{ question: question.question, answer: selectedAnswer }]).bundleText
        : selectedAnswer;

    return {
      ...question,
      currentAnswer,
      generatedAnswer,
      copyReadyAnswer,
      coverageStatus,
      gapReason: gapReason({
        ...question,
        currentAnswer,
        generatedAnswer,
        copyReadyAnswer,
        coverageStatus,
        gapReason: "",
      }),
    };
  });

  const finalizedQuestions: ShopifyKnowledgeBaseQuestion[] = questions.map((question) => ({
    id: question.id,
    category: question.category,
    question: question.question,
    currentAnswer: question.currentAnswer,
    generatedAnswer: question.generatedAnswer,
    copyReadyAnswer: question.copyReadyAnswer,
    coverageStatus: question.coverageStatus,
    gapReason: question.gapReason,
  }));

  const gaps = finalizedQuestions
    .map((question) => toGap(question, input.policyCoverage))
    .filter((value): value is ShopifyKnowledgeBaseGap => Boolean(value));

  const coveredCount = finalizedQuestions.filter((question) => question.coverageStatus === "covered").length;
  const partialCount = finalizedQuestions.filter((question) => question.coverageStatus === "partial").length;
  const missingCount = finalizedQuestions.filter((question) => question.coverageStatus === "missing").length;
  const coveragePercent = finalizedQuestions.length
    ? Math.round((coveredCount / finalizedQuestions.length) * 100)
    : 0;

  const policyGapCount = input.policyCoverage.filter((policy) => !policy.available).length;
  const missingBuyerQuestions = missingCount + partialCount;

  const supplementQuestionEntries = finalizedQuestions
    .filter((question) => question.category === "supplement_safety" || question.category === "product_guidance")
    .map((question) => ({ question: question.question, answer: question.generatedAnswer }));

  const generatedFaqBundle =
    supplementQuestionEntries.length > 0
      ? buildSupplementSafeFaqBundle(supplementQuestionEntries).bundleText
      : SHOPIFY_SUPPLEMENT_FDA_DISCLAIMER;

  const guardrails = supplementComplianceGuardrails();
  const summary: ShopifyKnowledgeBaseReadinessSummary = {
    coveragePercent,
    coveredCount,
    partialCount,
    missingCount,
    missingBuyerQuestions,
    policyGapCount,
    brandVoiceGuardrails: guardrails.slice(0, 5),
    queryLogPlaceholder: buildQueryLogPlaceholder(),
    generatedFaqBundle,
  };

  return {
    questions: finalizedQuestions,
    gaps,
    summary,
  };
}
