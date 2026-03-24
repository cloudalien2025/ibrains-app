type SerpOrganicResult = {
  title: string;
  link: string;
  snippet: string;
  position: number;
};

type SerpSummary = {
  common_topics: string[];
  common_phrases: string[];
  faq_patterns: string[];
};

type SerpEntities = {
  amenities: string[];
  location: string[];
  intent: string[];
};

export type Step2SerpDossierEnrichment = {
  query: string;
  location: string;
  status: "ready" | "skipped" | "failed";
  provider: "serpapi" | "disabled";
  organic_results: SerpOrganicResult[];
  summary: SerpSummary;
  entities: SerpEntities;
  evidence_gaps: string[];
  error_message: string | null;
};

type BuildInput = {
  listingTitle: string;
  listingCategory: string | null;
  listingCity: string | null;
  listingRegion: string | null;
  listingDescription: string | null;
  apiKey: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeUrl(value: unknown): string {
  const candidate = asText(value);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = asText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function topTokens(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    for (const token of tokenize(value)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter((entry) => entry[1] > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map((entry) => entry[0]);
}

function topPhrases(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const tokens = tokenize(value);
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter((entry) => entry[1] > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map((entry) => entry[0]);
}

function asSentenceQuestions(values: string[]): string[] {
  const questions: string[] = [];
  for (const value of values) {
    const segments = value
      .split(/[.?!]/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    for (const segment of segments) {
      if (/\b(how|what|when|where|which|is|are|does|can)\b/i.test(segment)) {
        questions.push(segment.endsWith("?") ? segment : `${segment}?`);
      }
    }
  }
  return dedupe(questions).slice(0, 12);
}

function extractEntities(input: { listingCity: string | null; listingRegion: string | null; snippets: string[]; listingDescription: string | null }): SerpEntities {
  const corpus = `${input.listingDescription ?? ""} ${input.snippets.join(" ")}`.toLowerCase();
  const amenityLexicon = [
    "wifi",
    "pool",
    "parking",
    "kitchen",
    "hot tub",
    "pet friendly",
    "air conditioning",
    "gym",
    "breakfast",
    "shuttle",
  ];
  const intentLexicon = [
    "family",
    "group",
    "couples",
    "business",
    "budget",
    "luxury",
    "pet",
    "ski",
    "booking",
    "cancellation",
    "check-in",
    "check out",
  ];

  const amenities = amenityLexicon.filter((item) => corpus.includes(item)).slice(0, 8);
  const intent = intentLexicon.filter((item) => corpus.includes(item)).slice(0, 8);
  const location = dedupe([input.listingCity, input.listingRegion]).slice(0, 6);

  return {
    amenities,
    location,
    intent,
  };
}

function deriveEvidenceGaps(input: {
  listingTitle: string;
  listingDescription: string | null;
  serpText: string;
  questions: string[];
}): string[] {
  const listingCorpus = `${input.listingTitle} ${input.listingDescription ?? ""}`.toLowerCase();
  const serpCorpus = `${input.serpText} ${input.questions.join(" ")}`.toLowerCase();
  const checks: Array<{ keyword: string; gap: string }> = [
    { keyword: "parking", gap: "Parking details are missing or unclear." },
    { keyword: "pet", gap: "Pet policy is missing or unclear." },
    { keyword: "cancellation", gap: "Cancellation policy details are missing." },
    { keyword: "check-in", gap: "Check-in and check-out timing is not clearly stated." },
    { keyword: "distance", gap: "Distance and proximity details are missing." },
    { keyword: "fees", gap: "Fee transparency is weak or missing." },
    { keyword: "availability", gap: "Availability guidance is not clearly covered." },
  ];
  const gaps: string[] = [];
  for (const check of checks) {
    if (serpCorpus.includes(check.keyword) && !listingCorpus.includes(check.keyword)) {
      gaps.push(check.gap);
    }
  }
  return dedupe(gaps).slice(0, 8);
}

async function fetchSerpapi(input: { query: string; location: string; apiKey: string }): Promise<{
  organic_results: SerpOrganicResult[];
  related_questions: string[];
  snippets: string[];
}> {
  const params = new URLSearchParams({
    q: input.query,
    location: input.location,
    hl: "en",
    gl: "us",
    num: "10",
    api_key: input.apiKey,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`SERPAPI_HTTP_${response.status}`);
    }
    const json = (await response.json()) as {
      organic_results?: Array<{ title?: unknown; link?: unknown; snippet?: unknown; position?: unknown }>;
      related_questions?: Array<{ question?: unknown }>;
    };
    const organic_results = (json.organic_results ?? [])
      .map((entry, index) => ({
        title: asText(entry.title),
        link: safeUrl(entry.link),
        snippet: asText(entry.snippet),
        position: Number(entry.position) || index + 1,
      }))
      .filter((entry) => entry.title && entry.link)
      .slice(0, 10);

    const related_questions = dedupe(
      (json.related_questions ?? []).map((entry) => asText(entry.question))
    ).slice(0, 10);
    const snippets = organic_results.map((entry) => entry.snippet).filter(Boolean);

    return {
      organic_results,
      related_questions,
      snippets,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildStep2SerpDossierEnrichment(input: BuildInput): Promise<Step2SerpDossierEnrichment> {
  const listingCategory = asText(input.listingCategory);
  const listingCity = asText(input.listingCity);
  const listingRegion = asText(input.listingRegion);
  const location = dedupe([listingCity, listingRegion]).join(", ");
  const query = dedupe([
    input.listingTitle,
    listingCity,
    listingCategory,
    "review OR booking OR stay",
  ]).join(" ");

  if (!asText(input.apiKey)) {
    return {
      query,
      location,
      status: "skipped",
      provider: "disabled",
      organic_results: [],
      summary: {
        common_topics: [],
        common_phrases: [],
        faq_patterns: [],
      },
      entities: {
        amenities: [],
        location: dedupe([listingCity, listingRegion]),
        intent: [],
      },
      evidence_gaps: [],
      error_message: "SERP API key not configured.",
    };
  }

  try {
    const serp = await fetchSerpapi({
      query,
      location: location || "United States",
      apiKey: asText(input.apiKey),
    });
    const titleTexts = serp.organic_results.map((entry) => entry.title);
    const snippets = serp.snippets;
    const faqPatterns = dedupe([...serp.related_questions, ...asSentenceQuestions(snippets)]).slice(0, 10);
    const serpText = [...titleTexts, ...snippets].join(" ");
    const entities = extractEntities({
      listingCity: input.listingCity,
      listingRegion: input.listingRegion,
      snippets,
      listingDescription: input.listingDescription,
    });
    const evidenceGaps = deriveEvidenceGaps({
      listingTitle: input.listingTitle,
      listingDescription: input.listingDescription,
      serpText,
      questions: faqPatterns,
    });

    return {
      query,
      location,
      status: "ready",
      provider: "serpapi",
      organic_results: serp.organic_results,
      summary: {
        common_topics: topTokens([...titleTexts, ...snippets], 12),
        common_phrases: topPhrases(snippets, 12),
        faq_patterns: faqPatterns,
      },
      entities,
      evidence_gaps: evidenceGaps,
      error_message: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERP enrichment failed.";
    return {
      query,
      location,
      status: "failed",
      provider: "serpapi",
      organic_results: [],
      summary: {
        common_topics: [],
        common_phrases: [],
        faq_patterns: [],
      },
      entities: {
        amenities: [],
        location: dedupe([listingCity, listingRegion]),
        intent: [],
      },
      evidence_gaps: [],
      error_message: message,
    };
  }
}
