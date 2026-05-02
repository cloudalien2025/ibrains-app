import type { CasaHudScriptData } from "@/lib/studio/domara/campaign-script-narrative";
import type { CasaHudScriptQualityIssue, CasaHudScriptReviewResult } from "@/lib/studio/domara/agents/types";
import { SCRIPT_QUALITY_REGEN_WARNING } from "@/lib/studio/domara/agents/script-agent";

const QUALITY_RULES: Array<{ code: string; pattern: RegExp }> = [
  { code: "script_ready_language", pattern: /\bscript-ready\s+listings?\b/i },
  { code: "approved_listings_language", pattern: /\bapproved\s+listings?\b/i },
  { code: "raw_field_chain", pattern: /\bwith\s+(?:EUR|USD)\s*\d[\d,.]*,\s*[^.]{0,120}\b(?:sqm|bathrooms?)\b/i },
  { code: "seo_sale_villa", pattern: /\bSale\s+villa\b/i },
  { code: "seo_houses_for_sale", pattern: /\bHouses?\s+for\s+sale\b/i },
  { code: "seo_real_estate_agencies", pattern: /\bReal\s+estate\s+agencies?\b/i },
  { code: "internal_deterministic_fallback", pattern: /\bdeterministic\s+fallback\b/i },
  { code: "internal_provider_metadata", pattern: /\bprovider\s+metadata\b/i },
  { code: "internal_validation_phase", pattern: /\bvalidation\s+phase\b/i },
  { code: "internal_listing_candidate", pattern: /\blisting\s+candidate\b/i },
  { code: "internal_candidate_listing", pattern: /\bcandidate\s+listing\b/i },
  { code: "internal_location_signal", pattern: /\blocation\s+signal\b/i },
  { code: "internal_title_promise", pattern: /\btitle\s+promise\b/i },
  { code: "internal_use_the_listing", pattern: /\buse\s+the\s+listing\b/i },
  { code: "internal_video_premise", pattern: /\bvideo\s+premise\b/i },
  { code: "location_spam", pattern: /\b\d{5}\s+[A-Za-z]+\s+[A-Za-z]+\s*,?\s+Italy\b/i },
];

function collectNarrationText(script: CasaHudScriptData): string {
  const segments = script.scriptSegments.map((segment) => segment.narration || "");
  if (typeof script.fullScriptText === "string" && script.fullScriptText.trim().length > 0) {
    segments.push(script.fullScriptText);
  }
  return segments.join("\n");
}

function excerptAround(text: string, index: number, radius = 64): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function reviewCasaHudViewerScript(script: CasaHudScriptData): CasaHudScriptReviewResult {
  const source = collectNarrationText(script);
  const issues: CasaHudScriptQualityIssue[] = [];

  for (const rule of QUALITY_RULES) {
    const match = source.match(rule.pattern);
    if (!match || typeof match.index !== "number") continue;
    issues.push({
      code: rule.code,
      snippet: excerptAround(source, match.index),
    });
  }

  if (issues.length === 0) {
    return { passed: true, issues: [] };
  }

  return {
    passed: false,
    issues,
    warning: SCRIPT_QUALITY_REGEN_WARNING,
  };
}
