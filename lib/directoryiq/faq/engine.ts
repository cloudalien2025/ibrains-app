import { composeFaqAnswers } from "@/lib/directoryiq/faq/faqAnswerComposer";
import { formatFaqHtml } from "@/lib/directoryiq/faq/faqHtmlFormatter";
import { resolveFaqIntentClusters } from "@/lib/directoryiq/faq/faqIntentClusters";
import { applyFaqPublishGate } from "@/lib/directoryiq/faq/faqPublishGate";
import { generateFaqQuestionCandidates } from "@/lib/directoryiq/faq/faqQuestionGenerator";
import { rankFaqQuestions } from "@/lib/directoryiq/faq/faqQuestionRanker";
import { evaluateFaqQuality } from "@/lib/directoryiq/faq/faqQualityValidator";
import { classifyListingArchetype } from "@/lib/directoryiq/faq/listingArchetypeClassifier";
import { resolveListingFacts } from "@/lib/directoryiq/faq/listingFactResolver";
import { enrichLocalContext } from "@/lib/directoryiq/faq/localContextEnricher";
import type { ListingFaqEngineResult } from "@/lib/directoryiq/faq/types";

export function buildListingFaqSupportEngine(input: {
  listingId: string;
  siteId: string | null;
  listingName: string;
  listingType: string;
  canonicalUrl: string;
  title: string;
  description: string;
  raw: Record<string, unknown>;
}): ListingFaqEngineResult {
  const classification = classifyListingArchetype({
    listingType: input.listingType,
    category: typeof input.raw.category === "string" ? input.raw.category : "",
    subcategory: typeof input.raw.subcategory === "string" ? input.raw.subcategory : "",
    title: input.title,
    description: input.description,
  });

  const context = enrichLocalContext(
    resolveListingFacts({
      listingId: input.listingId,
      siteId: input.siteId,
      listingName: input.listingName,
      listingType: input.listingType,
      listingArchetype: classification.archetype,
      canonicalUrl: input.canonicalUrl,
      title: input.title,
      description: input.description,
      raw: input.raw,
    })
  );

  const clusters = resolveFaqIntentClusters(context);
  const candidates = generateFaqQuestionCandidates({ context, clusters, minCandidates: 10, maxCandidates: 20 });
  const ranked = rankFaqQuestions({ candidates, minFinal: 6, maxFinal: 10 });
  const faqEntries = composeFaqAnswers({ context, selectedQuestions: ranked.selected });

  const validation = evaluateFaqQuality({
    context,
    faqEntries,
    selectedClusters: ranked.selected.map((item) => item.cluster),
  });

  const publishGate = applyFaqPublishGate({
    context,
    validation,
    selectedQuestionCount: ranked.selected.length,
  });

  const renderedHtml = formatFaqHtml({
    context,
    faqEntries,
  });

  return {
    context,
    classification,
    resolved_intent_clusters: clusters,
    candidate_questions: ranked.all,
    selected_questions: ranked.selected,
    faq_entries: faqEntries,
    source_facts: Array.from(new Set(faqEntries.flatMap((entry) => entry.source_facts))),
    fact_confidence_map: context.fact_confidence_map,
    quality: validation.quality,
    publish_gate_result: publishGate,
    rendered_html: renderedHtml,
  };
}
