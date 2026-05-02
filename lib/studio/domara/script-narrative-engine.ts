import { nowIso } from "@/lib/studio/domara/ai-channel-engine/ids";
import { buildCasaHudFallbackScript, buildCasaHudScriptPromptContext, buildLiveScriptProviderStatus, sanitizeCasaHudScriptData } from "@/lib/studio/domara/agents/script-agent";
import { reviewCasaHudViewerScript } from "@/lib/studio/domara/agents/review-agent";
import {
  parseCasaHudScriptData,
  type CasaHudScriptData,
} from "@/lib/studio/domara/campaign-script-narrative";
import type { CasaHudCampaign } from "@/lib/studio/domara/campaigns";

type FetchLike = typeof fetch;

type CasaHudScriptNarrativeOptions = {
  openAiApiKey?: string | null;
  fetchImpl?: FetchLike;
  providerTimeoutMs?: number;
  model?: string | null;
  generatedAt?: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type LiveScriptAttempt = {
  script: CasaHudScriptData | null;
  qualityWarning?: string;
};

const DEFAULT_OPENAI_TIMEOUT_MS = 4_500;

function buildOpenAiPrompt(campaign: CasaHudCampaign, fallback: CasaHudScriptData): string {
  const context = buildCasaHudScriptPromptContext(campaign, fallback);

  return [
    "You are CasaFlix's Script Agent for viewer-facing real-estate YouTube narration.",
    "Return valid JSON only.",
    "Never output strategy notes, prompt instructions, or internal QA wording inside spoken narration.",
    "Never include provider/site navigation or SEO fragments such as 'Sale villa', 'Houses for sale', or 'Real estate agencies'.",
    "Never use internal terms in spoken narration: script-ready listings, approved listings, validation phase, candidate listing, title promise, location signal, deterministic fallback, provider metadata.",
    "Avoid raw field-dump chains like: 'with EUR 300,000, Single family villa, 2 bathrooms, 187 sqm'.",
    "For one-listing campaigns, use natural singular grammar and host voice.",
    "Keep all claims grounded in provided listing and location data. Do not invent unsupported facts.",
    "Keys required:",
    "scriptSummary, openingHook, estimatedDurationSeconds, tone, scriptSegments, propertySegments, locationLifestyleLines, transitions, closingCta, toneAndPacingNotes, scriptWarnings, fullScriptText",
    "Each scriptSegments item must include id, title, segmentType, narration, durationSeconds, optional associatedListingId, optional visualNote.",
    "Each propertySegments item must include listingId, title, locationText, narration, whyItMadeTheCut, supportedFacts, optional locationLine, optional caution.",
    "Context JSON follows:",
    JSON.stringify(context),
  ].join("\n");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      promise.then(resolve).catch(reject);
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function tryLiveOpenAiScript(
  campaign: CasaHudCampaign,
  fallback: CasaHudScriptData,
  options: Required<Pick<CasaHudScriptNarrativeOptions, "openAiApiKey" | "fetchImpl" | "providerTimeoutMs" | "model">>,
): Promise<LiveScriptAttempt> {
  const response = await withTimeout(
    options.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write truthful, polished, host-led real-estate YouTube scripts. Return machine-readable JSON only.",
          },
          {
            role: "user",
            content: buildOpenAiPrompt(campaign, fallback),
          },
        ],
      }),
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`openai http ${res.status}`);
      }
      return (await res.json()) as OpenAiChatCompletionResponse;
    }),
    options.providerTimeoutMs,
  );

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) return { script: null };

  const parsed = JSON.parse(content) as Record<string, unknown>;
  const script = parseCasaHudScriptData(parsed);
  if (script.scriptGenerationStatus !== "script_generated") return { script: null };

  const sanitized = sanitizeCasaHudScriptData({
    ...script,
    scriptProviderStatus: buildLiveScriptProviderStatus(
      "Using OpenAI Script Agent output to produce the review-ready narration package.",
    ),
  });

  const review = reviewCasaHudViewerScript(sanitized);
  if (!review.passed) {
    return {
      script: null,
      qualityWarning: review.warning,
    };
  }

  return { script: sanitized };
}

export async function runCasaHudScriptNarrative(
  campaign: CasaHudCampaign,
  options: CasaHudScriptNarrativeOptions = {},
): Promise<CasaHudScriptData> {
  const generatedAt = options.generatedAt || nowIso();
  const fallback = buildCasaHudFallbackScript(campaign, { generatedAt });
  const openAiApiKey = options.openAiApiKey?.trim();

  if (!openAiApiKey) {
    return fallback;
  }

  try {
    const liveAttempt = await tryLiveOpenAiScript(campaign, fallback, {
      openAiApiKey,
      fetchImpl: options.fetchImpl || fetch,
      providerTimeoutMs: Math.max(500, options.providerTimeoutMs || DEFAULT_OPENAI_TIMEOUT_MS),
      model: options.model?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    });

    if (liveAttempt.script) {
      return liveAttempt.script;
    }

    if (liveAttempt.qualityWarning) {
      return buildCasaHudFallbackScript(campaign, {
        generatedAt,
        extraWarnings: [liveAttempt.qualityWarning],
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live script generation failed.";
    return buildCasaHudFallbackScript(campaign, {
      generatedAt,
      extraWarnings: [
        `OpenAI script generation was unavailable (${message}), so CasaFlix used deterministic Script Agent composition instead.`,
      ],
    });
  }

  return buildCasaHudFallbackScript(campaign, {
    generatedAt,
    extraWarnings: [
      "OpenAI returned an incomplete or low-quality narrative payload, so CasaFlix used deterministic Script Agent composition instead.",
    ],
  });
}
