import { PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";
import { validateDomaraImageUrls } from "@/lib/studio/domara/image-handling";

export type DomaraRenderStyle = "property_showcase" | "expat_ai_editorial" | "premium_listing";

export type DomaraRenderTimelineScene = {
  order: number;
  title: string;
  overlayText: string;
  narration: string;
  durationSeconds: number;
  imageUrl?: string;
};

export type DomaraVideoRenderRequest = {
  plan: PropertyVideoPlan;
  listingInput: PropertyListingInput;
  stylePreset?: DomaraRenderStyle;
};

export type DomaraVideoRenderPlan = {
  id: string;
  channel: "Expat AI";
  useCase: "property_video_engine";
  market: string;
  title: string;
  imageUrls: string[]; // validated and ordered
  requestedImageCount: number;
  skippedImageCount: number;
  imageValidationWarnings: string[];
  totalDurationSeconds: number;
  timeline: DomaraRenderTimelineScene[];
  renderMode: "mock-first local render";
  stylePreset: DomaraRenderStyle;
  sourceAttribution?: {
    source?: string;
    listingUrl?: string;
  };
};

export type DomaraVideoRenderResult = {
  status: "complete";
  renderId: string;
  downloadUrl: string;
  outputPath: string;
  filename: string;
  durationSeconds: number;
  sceneCount: number;
  imageCount: number;
  skippedImageCount: number;
  renderMode: "mock-first local render";
  stylePreset: DomaraRenderStyle;
  generatedAt: string;
  audioIncluded: boolean;
  sourceAttribution?: {
    source?: string;
    listingUrl?: string;
  };
};

function fallbackSceneDuration(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 6;
  return Math.max(4, Math.min(20, Math.floor(durationSeconds)));
}

export function createDomaraRenderPlan(request: DomaraVideoRenderRequest): DomaraVideoRenderPlan {
  const rawImageUrls = request.listingInput.imageUrls.filter(Boolean);
  const validation = validateDomaraImageUrls(rawImageUrls);
  const imageUrls = validation.acceptedUrls;
  const market = request.listingInput.country || "Italy";
  const stylePreset = request.stylePreset ?? "expat_ai_editorial";
  const timeline = request.plan.scenes.map((scene, index) => ({
    order: scene.order,
    title: scene.title,
    overlayText: scene.overlayText,
    narration: scene.narration,
    durationSeconds: fallbackSceneDuration(scene.durationSeconds),
    imageUrl: imageUrls.length ? imageUrls[index % imageUrls.length] : undefined,
  }));

  const fallbackTimeline =
    timeline.length > 0
      ? timeline
      : [
          {
            order: 1,
            title: "Cinematic Opening",
            overlayText: request.plan.youtubeTitle,
            narration: request.plan.hook,
            durationSeconds: 8,
            imageUrl: imageUrls[0],
          },
          {
            order: 2,
            title: "Property Highlights",
            overlayText: request.listingInput.title || "Studio Property Video Engine",
            narration:
              "Image gallery is unavailable. Rendering with branded fallback scenes while preserving Expat AI editorial structure.",
            durationSeconds: 7,
            imageUrl: imageUrls[0],
          },
          {
            order: 3,
            title: "Source Attribution",
            overlayText: request.listingInput.source || "Manual Listing Input",
            narration:
              "Source attribution is included for editorial transparency. Location enrichment remains a clearly labeled placeholder when unavailable.",
            durationSeconds: 5,
            imageUrl: imageUrls[1] ?? imageUrls[0],
          },
          {
            order: 4,
            title: "Expat AI Closing",
            overlayText: "Created for Expat AI",
            narration: "Location enrichment placeholder - Google Maps / Places integration pending.",
            durationSeconds: 6,
            imageUrl: undefined,
          },
        ];

  return {
    id: `domara-render-${request.plan.id}`,
    channel: "Expat AI",
    useCase: "property_video_engine",
    market,
    title: request.listingInput.title || request.plan.youtubeTitle,
    imageUrls,
    requestedImageCount: rawImageUrls.length,
    skippedImageCount: validation.skippedUrls.length,
    imageValidationWarnings: validation.warnings,
    totalDurationSeconds: fallbackTimeline.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    timeline: fallbackTimeline,
    renderMode: "mock-first local render",
    stylePreset,
    sourceAttribution: {
      source: request.listingInput.source || undefined,
      listingUrl: request.listingInput.listingUrl || undefined,
    },
  };
}
