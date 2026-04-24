import { createLocationProvider } from "@/lib/studio/domara/location-provider";
import { DomaraLocationEnrichment, NormalizedPropertyListing, PropertyVideoScene } from "@/lib/studio/domara/types";

export type DomaraStoryDraft = {
  hook: string;
  scenes: PropertyVideoScene[];
  narrationScript: string;
  youtubeTitle: string;
  youtubeDescription: string;
};

export type DomaraRenderDraft = {
  status: "pending_provider_connection";
  nextStep: string;
  provider: string;
};

export interface RealEstateListingProvider {
  providerName: "idealista" | "immobiliare" | "manual";
  ingest(listing: NormalizedPropertyListing): Promise<NormalizedPropertyListing>;
}

export interface LocationEnrichmentProvider {
  providerName: "google_maps_places" | "mapbox" | "mock";
  enrich(listing: NormalizedPropertyListing): Promise<DomaraLocationEnrichment>;
}

export interface StoryGenerationProvider {
  providerName: "openai_editorial" | "mock";
  generateStory(
    listing: NormalizedPropertyListing,
    context: DomaraLocationEnrichment,
    angleLabel: string,
    inputDescription: string,
  ): Promise<DomaraStoryDraft>;
}

export interface VoiceGenerationProvider {
  providerName: "elevenlabs" | "mock";
  prepareVoiceDraft(script: string): Promise<{ provider: string; status: string }>;
}

export interface VideoRenderProvider {
  providerName: "studio_renderer" | "ffmpeg" | "mock";
  prepareRenderDraft(story: DomaraStoryDraft): Promise<DomaraRenderDraft>;
}

export interface YoutubeProvider {
  providerName: "youtube_data_api" | "mock";
  preparePublishingPayload(title: string, description: string): Promise<{ status: string }>;
}

const mockListingProvider: RealEstateListingProvider = {
  providerName: "manual",
  async ingest(listing) {
    return listing;
  },
};

const mockStoryProvider: StoryGenerationProvider = {
  providerName: "mock",
  async generateStory(listing, context, angleLabel, inputDescription) {
    const overviewLine = listing.propertyFacts.length
      ? `${listing.propertyFacts.join(" • ")}`
      : "Property facts will be expanded as source metadata becomes richer";
    const shortLocation = listing.locationLabel;
    const lifestyleLine =
      angleLabel === "Lifestyle"
        ? "This narrative leans into daily rhythm, walkability, and quality-of-life cues."
        : `Primary content angle: ${angleLabel}.`;
    const descriptionLine = inputDescription.trim()
      ? inputDescription.trim()
      : "Listing description was not provided. Script uses conservative editorial framing.";
    const poiCategoryLine = context.pointsOfInterest.length
      ? `POI focus: ${context.pointsOfInterest
          .slice(0, 4)
          .map((poi) => poi.category.replace(/_/g, " "))
          .join(", ")}.`
      : "POI enrichment placeholder only.";

    const hook = `In ${shortLocation}, this ${listing.title} opens with a distinct blend of Italian character and modern livability.`;
    const scenes: PropertyVideoScene[] = [
      {
        order: 1,
        title: "Opening Hook",
        visualDirection: "Slow cinematic reveal of facade and strongest hero image with editorial text overlays.",
        narration: hook,
        overlayText: `${shortLocation} | ${listing.priceLabel}`,
        suggestedMedia: ["Hero exterior image", "Title animation plate"],
        durationSeconds: 10,
      },
      {
        order: 2,
        title: "Property Overview",
        visualDirection: "Structured card-style highlights with price, property type, and layout facts.",
        narration: `A quick overview: ${listing.priceLabel}. ${overviewLine}.`,
        overlayText: listing.title,
        suggestedMedia: ["Fact card templates", "Listing detail closeups"],
        durationSeconds: 13,
      },
      {
        order: 3,
        title: "Interior Showcase",
        visualDirection: "Rhythmic interior sequence with gentle zoom and pace-matched cuts.",
        narration: `Inside, the visual story emphasizes proportion, light, and practical flow. ${descriptionLine}`,
        overlayText: "Interior Flow & Finishes",
        suggestedMedia: ["Interior gallery", "Kitchen/living details", "Bedroom sequence"],
        durationSeconds: 22,
      },
      {
        order: 4,
        title: "Location Context",
        visualDirection: "Map-led transition into district-level context and geographic framing.",
        narration: context.summary,
        overlayText: "Neighborhood Context",
        suggestedMedia: ["Map placeholder motion plate", "City B-roll placeholders"],
        durationSeconds: 14,
      },
      {
        order: 5,
        title: "Lifestyle & Convenience",
        visualDirection: "Street-life, cafe, and local rhythm b-roll with warm cinematic grading.",
        narration: `${lifestyleLine} Convenience analysis remains descriptive and avoids unsupported distance claims before POI verification. ${
          context.placeholderMessage || ""
        } ${poiCategoryLine}`,
        overlayText: "Lifestyle Perspective",
        suggestedMedia: ["Lifestyle b-roll placeholders", "Neighborhood stills"],
        durationSeconds: 16,
      },
      {
        order: 6,
        title: "Practical Considerations",
        visualDirection: "Calm editorial framing with practical notes and non-promissory positioning.",
        narration:
          "For international buyers, this segment frames utility, long-term fit, and market context without promises on returns or appreciation.",
        overlayText: "Practical Perspective",
        suggestedMedia: ["Text-led explainer card", "Supportive still sequence"],
        durationSeconds: 14,
      },
      {
        order: 7,
        title: "Closing CTA",
        visualDirection: "Brand-consistent outro and source attribution end card.",
        narration:
          "For full walkthrough details and upcoming Italy features, follow Expat AI and review attribution links in the video description.",
        overlayText: "Expat AI | Subscribe for More Italy Tours",
        suggestedMedia: ["Outro template", "Attribution slate"],
        durationSeconds: 11,
      },
    ];

    const narrationScript = scenes.map((scene) => `Scene ${scene.order} - ${scene.title}: ${scene.narration}`).join("\n\n");
    const youtubeTitle = `${listing.title} in ${shortLocation} | Italy Property Tour by Expat AI`;
    const youtubeDescription = [
      `Explore this featured property in ${shortLocation}, curated by Expat AI.`,
      `Listing snapshot: ${listing.priceLabel}${listing.propertyFacts.length ? ` | ${listing.propertyFacts.join(" | ")}` : ""}.`,
      "",
      "Editorial note:",
      "This video is generated for informational storytelling and does not constitute investment advice.",
      "",
      "Source attribution:",
      listing.sourceMetadata.source ?? "Manual source pending",
      listing.sourceMetadata.listingUrl ?? "Listing URL pending",
      "",
      `Location intelligence: ${context.poiNotes.join(" ")}`,
    ].join("\n");

    return {
      hook,
      scenes,
      narrationScript,
      youtubeTitle,
      youtubeDescription,
    };
  },
};

const mockVoiceProvider: VoiceGenerationProvider = {
  providerName: "mock",
  async prepareVoiceDraft() {
    return {
      provider: "ElevenLabs",
      status: "Placeholder only. Voice generation queue will activate after provider keys are connected.",
    };
  },
};

const mockRenderProvider: VideoRenderProvider = {
  providerName: "mock",
  async prepareRenderDraft() {
    return {
      status: "pending_provider_connection",
      nextStep:
        "Connect Studio renderer pipeline (FFmpeg / internal compositor), then map storyboard scenes to timeline assets.",
      provider: "Studio video pipeline placeholder",
    };
  },
};

const mockYoutubeProvider: YoutubeProvider = {
  providerName: "mock",
  async preparePublishingPayload() {
    return { status: "YouTube publish adapter pending. Metadata draft is ready for future API handoff." };
  },
};

export function createDomaraMockProviders() {
  const locationProvider: LocationEnrichmentProvider = createLocationProvider();
  return {
    listingProvider: mockListingProvider,
    locationProvider,
    storyProvider: mockStoryProvider,
    voiceProvider: mockVoiceProvider,
    renderProvider: mockRenderProvider,
    youtubeProvider: mockYoutubeProvider,
  };
}
