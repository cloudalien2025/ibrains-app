import { PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";

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
};

export type DomaraVideoRenderPlan = {
  id: string;
  channel: "Expat AI";
  useCase: "property_video_engine";
  market: string;
  title: string;
  imageUrls: string[];
  totalDurationSeconds: number;
  timeline: DomaraRenderTimelineScene[];
  renderMode: "mock-first local render";
};

export type DomaraVideoRenderResult = {
  status: "complete";
  renderId: string;
  downloadUrl: string;
  filename: string;
  durationSeconds: number;
  sceneCount: number;
  imageCount: number;
  renderMode: "mock-first local render";
};

function fallbackSceneDuration(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 6;
  return Math.max(4, Math.min(20, Math.floor(durationSeconds)));
}

export function createDomaraRenderPlan(request: DomaraVideoRenderRequest): DomaraVideoRenderPlan {
  const imageUrls = request.listingInput.imageUrls.filter(Boolean);
  const market = request.listingInput.country || "Italy";
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
            title: "Opening Hook",
            overlayText: request.plan.youtubeTitle,
            narration: request.plan.hook,
            durationSeconds: 8,
            imageUrl: imageUrls[0],
          },
          {
            order: 2,
            title: "Closing CTA",
            overlayText: "Created for Expat AI",
            narration: "Location enrichment placeholder - Google Maps / Places integration pending.",
            durationSeconds: 6,
            imageUrl: imageUrls[1] ?? imageUrls[0],
          },
        ];

  return {
    id: `domara-render-${request.plan.id}`,
    channel: "Expat AI",
    useCase: "property_video_engine",
    market,
    title: request.listingInput.title || request.plan.youtubeTitle,
    imageUrls,
    totalDurationSeconds: fallbackTimeline.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    timeline: fallbackTimeline,
    renderMode: "mock-first local render",
  };
}

