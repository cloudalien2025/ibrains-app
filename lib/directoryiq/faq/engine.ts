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

type SerpSummaryInput = {
  common_topics: string[];
  common_phrases: string[];
  faq_patterns: string[];
};

type SerpEntitiesInput = {
  amenities: string[];
  location: string[];
  intent: string[];
};

type SerpResultInput = {
  title: string;
  link: string;
  snippet: string;
  position: number;
};

type SerpDossierInput = {
  serp_summary: SerpSummaryInput;
  entities: SerpEntitiesInput;
  evidence_gaps: string[];
  serp_results: SerpResultInput[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\n|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeSerpResult(value: unknown): SerpResultInput | null {
  const row = asObject(value);
  const title = asString(row.title);
  const link = asString(row.link);
  const snippet = asString(row.snippet);
  const position = typeof row.position === "number" ? row.position : Number(row.position) || 0;
  if (!title && !snippet) return null;
  return { title, link, snippet, position };
}

function resolveSerpDossier(raw: Record<string, unknown>): SerpDossierInput {
  const dossier = asObject(raw.research_dossier);
  const source = Object.keys(dossier).length > 0 ? dossier : raw;
  const serpSummaryRaw = asObject(source.serp_summary);
  const entitiesRaw = asObject(source.entities);
  const serpResultsRaw = Array.isArray(source.serp_results) ? source.serp_results : [];

  return {
    serp_summary: {
      common_topics: asStringArray(serpSummaryRaw.common_topics),
      common_phrases: asStringArray(serpSummaryRaw.common_phrases),
      faq_patterns: asStringArray(serpSummaryRaw.faq_patterns),
    },
    entities: {
      amenities: asStringArray(entitiesRaw.amenities),
      location: asStringArray(entitiesRaw.location),
      intent: asStringArray(entitiesRaw.intent),
    },
    evidence_gaps: asStringArray(source.evidence_gaps),
    serp_results: serpResultsRaw.map((item) => normalizeSerpResult(item)).filter((item): item is SerpResultInput => item !== null),
  };
}

function normalizeAnswer(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function buildSerpQualityBlocks(input: {
  answers: string[];
  sourceFacts: string[];
  fallbackRatio: number;
  entities: SerpEntitiesInput;
}): string[] {
  const normalized = input.answers.map((answer) => normalizeAnswer(answer));
  const duplicateRatio =
    normalized.length <= 1 ? 0 : (normalized.length - new Set(normalized).size) / Math.max(1, normalized.length);
  const entityTerms = new Set(
    [...input.entities.amenities, ...input.entities.location, ...input.entities.intent].map((item) => item.toLowerCase()).filter(Boolean)
  );

  const answersWithEntities =
    input.answers.length === 0
      ? 0
      : input.answers.filter((answer) => {
          const lower = answer.toLowerCase();
          for (const entity of entityTerms) {
            if (entity && lower.includes(entity)) return true;
          }
          return false;
        }).length / input.answers.length;

  const reasons: string[] = [];
  if (input.fallbackRatio > 0.5) reasons.push("faq fallback ratio exceeds 50%");
  if (duplicateRatio > 0.2) reasons.push("faq answers are repetitive");
  if (entityTerms.size > 0 && answersWithEntities < 0.5) reasons.push("faq answers lack entity grounding");
  if (input.sourceFacts.length === 0) reasons.push("faq answers are missing grounded facts");
  return reasons;
}

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
  const serpDossier = resolveSerpDossier(input.raw);

  const clusters = resolveFaqIntentClusters(context);
  const hasSerpSignals =
    serpDossier.serp_summary.faq_patterns.length > 0 ||
    serpDossier.evidence_gaps.length > 0 ||
    serpDossier.serp_results.length > 0 ||
    serpDossier.entities.amenities.length > 0 ||
    serpDossier.entities.location.length > 0 ||
    serpDossier.entities.intent.length > 0;
  const candidates = generateFaqQuestionCandidates({
    context,
    clusters,
    serpSummary: serpDossier.serp_summary,
    entities: serpDossier.entities,
    evidenceGaps: serpDossier.evidence_gaps,
    minCandidates: 10,
    maxCandidates: 20,
  });
  const ranked = rankFaqQuestions({ candidates, minFinal: 6, maxFinal: 10 });
  let faqEntries = composeFaqAnswers({
    context,
    selectedQuestions: ranked.selected,
    serpSummary: serpDossier.serp_summary,
    entities: serpDossier.entities,
    evidenceGaps: serpDossier.evidence_gaps,
    serpResults: serpDossier.serp_results,
  });

  if (!hasSerpSignals && faqEntries.length < 4) {
    faqEntries = composeFaqAnswers({
      context,
      selectedQuestions: ranked.selected,
      serpSummary: serpDossier.serp_summary,
      entities: serpDossier.entities,
      evidenceGaps: ["missing public details"],
      serpResults: serpDossier.serp_results,
    });
  }

  const fallbackRatio =
    faqEntries.length === 0
      ? 1
      : faqEntries.filter((entry) => {
          const plain = entry.answer_plaintext.toLowerCase();
          return entry.fact_confidence === "unknown" || plain.includes("please verify") || plain.includes("confirm with the host");
        }).length / faqEntries.length;
  const serpQualityBlocks = hasSerpSignals
    ? buildSerpQualityBlocks({
        answers: faqEntries.map((entry) => entry.answer_plaintext),
        sourceFacts: faqEntries.flatMap((entry) => entry.source_facts).filter(Boolean),
        fallbackRatio,
        entities: serpDossier.entities,
      })
    : [];

  const baseValidation = evaluateFaqQuality({
    context,
    faqEntries,
    selectedClusters: ranked.selected.map((item) => item.cluster),
  });
  const validation = {
    ...baseValidation,
    blockedReasons: Array.from(new Set([...baseValidation.blockedReasons, ...serpQualityBlocks])),
  };

  const publishGate = applyFaqPublishGate({
    context,
    validation,
    finalFaqEntryCount: faqEntries.length,
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
