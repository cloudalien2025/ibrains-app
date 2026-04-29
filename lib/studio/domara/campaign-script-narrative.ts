export type CasaHudScriptGenerationStatus = "not_started" | "script_generated";

export type CasaHudScriptProvider = "openai" | "casahud_script_patterns";
export type CasaHudScriptProviderState = "connected" | "fallback" | "error";

export type CasaHudScriptProviderStatus = {
  provider: CasaHudScriptProvider;
  label: string;
  state: CasaHudScriptProviderState;
  configured: boolean;
  used: boolean;
  detail: string;
  warning?: string;
};

export type CasaHudScriptSegmentType =
  | "hook"
  | "premise"
  | "location_context"
  | "property_focus"
  | "comparison"
  | "transition"
  | "closing_cta";

export type CasaHudScriptSegment = {
  id: string;
  title: string;
  segmentType: CasaHudScriptSegmentType;
  narration: string;
  durationSeconds: number;
  associatedListingId?: string;
  visualNote?: string;
};

export type CasaHudPropertySegment = {
  listingId: string;
  title: string;
  locationText: string;
  narration: string;
  whyItMadeTheCut: string;
  supportedFacts: string[];
  locationLine?: string;
  caution?: string;
};

export type CasaHudScriptData = {
  scriptGenerationStatus: CasaHudScriptGenerationStatus;
  scriptSummary: string | null;
  openingHook: string | null;
  estimatedDurationSeconds: number | null;
  tone: string | null;
  scriptSegments: CasaHudScriptSegment[];
  propertySegments: CasaHudPropertySegment[];
  locationLifestyleLines: string[];
  transitions: string[];
  closingCta: string | null;
  toneAndPacingNotes: string[];
  scriptWarnings: string[];
  scriptProviderStatus: CasaHudScriptProviderStatus | null;
  fullScriptText: string | null;
};

export type CasaHudCampaignFutureScriptState = {
  status: CasaHudScriptGenerationStatus;
  summary?: string;
  generatedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isScriptGenerationStatus(value: unknown): value is CasaHudScriptGenerationStatus {
  return value === "not_started" || value === "script_generated";
}

function isScriptProvider(value: unknown): value is CasaHudScriptProvider {
  return value === "openai" || value === "casahud_script_patterns";
}

function isScriptProviderState(value: unknown): value is CasaHudScriptProviderState {
  return value === "connected" || value === "fallback" || value === "error";
}

function isScriptProviderStatus(value: unknown): value is CasaHudScriptProviderStatus {
  return (
    isRecord(value) &&
    isScriptProvider(value.provider) &&
    isNonEmptyString(value.label) &&
    isScriptProviderState(value.state) &&
    typeof value.configured === "boolean" &&
    typeof value.used === "boolean" &&
    isNonEmptyString(value.detail) &&
    (value.warning === undefined || isNonEmptyString(value.warning))
  );
}

function isScriptSegmentType(value: unknown): value is CasaHudScriptSegmentType {
  return (
    value === "hook" ||
    value === "premise" ||
    value === "location_context" ||
    value === "property_focus" ||
    value === "comparison" ||
    value === "transition" ||
    value === "closing_cta"
  );
}

function isScriptSegment(value: unknown): value is CasaHudScriptSegment {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isScriptSegmentType(value.segmentType) &&
    isNonEmptyString(value.narration) &&
    isFiniteNumber(value.durationSeconds) &&
    (value.associatedListingId === undefined || isNonEmptyString(value.associatedListingId)) &&
    (value.visualNote === undefined || isNonEmptyString(value.visualNote))
  );
}

function isPropertySegment(value: unknown): value is CasaHudPropertySegment {
  return (
    isRecord(value) &&
    isNonEmptyString(value.listingId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.locationText) &&
    isNonEmptyString(value.narration) &&
    isNonEmptyString(value.whyItMadeTheCut) &&
    isStringArray(value.supportedFacts) &&
    (value.locationLine === undefined || isNonEmptyString(value.locationLine)) &&
    (value.caution === undefined || isNonEmptyString(value.caution))
  );
}

export function createEmptyCasaHudScriptData(): CasaHudScriptData {
  return {
    scriptGenerationStatus: "not_started",
    scriptSummary: null,
    openingHook: null,
    estimatedDurationSeconds: null,
    tone: null,
    scriptSegments: [],
    propertySegments: [],
    locationLifestyleLines: [],
    transitions: [],
    closingCta: null,
    toneAndPacingNotes: [],
    scriptWarnings: [],
    scriptProviderStatus: null,
    fullScriptText: null,
  };
}

export function buildCasaHudFutureScriptState(
  data: Pick<CasaHudScriptData, "scriptGenerationStatus" | "scriptSummary">,
): CasaHudCampaignFutureScriptState | null {
  if (data.scriptGenerationStatus !== "script_generated") return null;
  return {
    status: data.scriptGenerationStatus,
    summary: data.scriptSummary || undefined,
  };
}

export function parseCasaHudScriptData(campaign: Record<string, unknown>): CasaHudScriptData {
  const scriptSummary = isNonEmptyString(campaign.scriptSummary) ? campaign.scriptSummary : null;
  const openingHook = isNonEmptyString(campaign.openingHook) ? campaign.openingHook : null;
  const estimatedDurationSeconds = isFiniteNumber(campaign.estimatedDurationSeconds) ? campaign.estimatedDurationSeconds : null;
  const tone = isNonEmptyString(campaign.tone) ? campaign.tone : null;
  const scriptSegments = Array.isArray(campaign.scriptSegments)
    ? campaign.scriptSegments.filter((item): item is CasaHudScriptSegment => isScriptSegment(item))
    : [];
  const propertySegments = Array.isArray(campaign.propertySegments)
    ? campaign.propertySegments.filter((item): item is CasaHudPropertySegment => isPropertySegment(item))
    : [];
  const locationLifestyleLines = isStringArray(campaign.locationLifestyleLines) ? campaign.locationLifestyleLines : [];
  const transitions = isStringArray(campaign.transitions) ? campaign.transitions : [];
  const closingCta = isNonEmptyString(campaign.closingCta) ? campaign.closingCta : null;
  const toneAndPacingNotes = isStringArray(campaign.toneAndPacingNotes) ? campaign.toneAndPacingNotes : [];
  const scriptWarnings = isStringArray(campaign.scriptWarnings) ? campaign.scriptWarnings : [];
  const scriptProviderStatus = isScriptProviderStatus(campaign.scriptProviderStatus) ? campaign.scriptProviderStatus : null;
  const fullScriptText = isNonEmptyString(campaign.fullScriptText) ? campaign.fullScriptText : null;

  const scriptGenerationStatus = isScriptGenerationStatus(campaign.scriptGenerationStatus)
    ? campaign.scriptGenerationStatus
    : scriptSummary ||
        openingHook ||
        scriptSegments.length > 0 ||
        propertySegments.length > 0 ||
        locationLifestyleLines.length > 0 ||
        transitions.length > 0 ||
        closingCta ||
        toneAndPacingNotes.length > 0 ||
        fullScriptText
      ? "script_generated"
      : "not_started";

  return {
    scriptGenerationStatus,
    scriptSummary,
    openingHook,
    estimatedDurationSeconds,
    tone,
    scriptSegments,
    propertySegments,
    locationLifestyleLines,
    transitions,
    closingCta,
    toneAndPacingNotes,
    scriptWarnings,
    scriptProviderStatus,
    fullScriptText,
  };
}
