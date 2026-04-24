import { normalizePropertyListingInput } from "@/lib/studio/domara/listing-normalizer";
import { createDomaraMockProviders } from "@/lib/studio/domara/providers";
import { PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";

function stablePlanId(seed: string): string {
  let hash = 7;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `plan-${Math.abs(hash).toString(16)}`;
}

function resolveAngleLabel(input: PropertyListingInput): string {
  if (!input.contentAngle) return "Lifestyle";
  if (input.contentAngle === "second_home") return "Second Home";
  if (input.contentAngle === "hidden_gem") return "Hidden Gem";
  if (input.contentAngle === "deal_spotlight") return "Deal Spotlight";
  return input.contentAngle[0].toUpperCase() + input.contentAngle.slice(1);
}

export async function generatePropertyVideoPlan(input: PropertyListingInput): Promise<PropertyVideoPlan> {
  const providers = createDomaraMockProviders();
  const normalized = normalizePropertyListingInput(input);
  const ingested = await providers.listingProvider.ingest(normalized);
  const enrichment = await providers.locationProvider.enrich(ingested);
  const angleLabel = resolveAngleLabel(input);
  const story = await providers.storyProvider.generateStory(ingested, enrichment, angleLabel, input.description ?? "");
  const voiceDraft = await providers.voiceProvider.prepareVoiceDraft(story.narrationScript);
  const renderPlaceholder = await providers.renderProvider.prepareRenderDraft(story);
  const youtubeDraft = await providers.youtubeProvider.preparePublishingPayload(story.youtubeTitle, story.youtubeDescription);

  const summary = [
    `${ingested.title} in ${ingested.locationLabel}.`,
    `Market: ${ingested.market}.`,
    `Asking price: ${ingested.priceLabel}.`,
    ingested.propertyFacts.length ? `Facts: ${ingested.propertyFacts.join(" • ")}.` : "Facts: metadata enrichment pending.",
    `Content angle: ${angleLabel}.`,
    `Voice: ${voiceDraft.status}`,
    `YouTube handoff: ${youtubeDraft.status}`,
  ].join(" ");

  return {
    id: stablePlanId(`${ingested.id}|${angleLabel}|${story.youtubeTitle}`),
    channel: "Expat AI",
    status: "draft_plan_ready",
    listingSummary: summary,
    hook: story.hook,
    scenes: story.scenes,
    narrationScript: story.narrationScript,
    youtubeTitle: story.youtubeTitle,
    youtubeDescription: story.youtubeDescription,
    enrichmentSummary: enrichment.summary,
    renderPlaceholder,
  };
}

