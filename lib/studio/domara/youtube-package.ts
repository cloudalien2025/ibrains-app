import { DomaraVideoRenderResult } from "@/lib/studio/domara/render-plan";
import { DomaraContentAngle, PropertyListingInput, PropertyVideoPlan } from "@/lib/studio/domara/types";

export type DomaraTitleOption = {
  angle: DomaraContentAngle | "expat_relocation" | "under_budget";
  title: string;
};

export type DomaraThumbnailConcept = {
  text: string;
  visualDirection: string;
};

export type DomaraShortsIdea = {
  hook: string;
  sourceSceneTitle: string;
  captionDraft: string;
  titleDraft: string;
};

export type DomaraChapter = {
  timestamp: string;
  title: string;
};

export type DomaraPublishingMetadata = {
  sourceAttribution: string;
  mapAttribution?: string;
  complianceNote: string;
  generatedAt: string;
  renderLinked: boolean;
};

export type DomaraYouTubePackage = {
  finalRecommendedTitle: string;
  titleVariants: DomaraTitleOption[];
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: DomaraChapter[];
  pinnedComment: string;
  thumbnailIdeas: DomaraThumbnailConcept[];
  shortsIdeas: DomaraShortsIdea[];
  contentAngleVariants: string[];
  metadata: DomaraPublishingMetadata;
};

export interface YouTubePublishingProvider {
  providerName: "youtube_data_api" | "mock";
  prepareUploadDraft(packageData: DomaraYouTubePackage): Promise<{ status: "pending"; note: string }>;
}

export class MockYouTubePublishingProvider implements YouTubePublishingProvider {
  providerName = "mock" as const;

  async prepareUploadDraft(): Promise<{ status: "pending"; note: string }> {
    return {
      status: "pending",
      note: "YouTube Data API integration placeholder. Package is ready for manual upload workflow.",
    };
  }
}

function clampSceneDurations(plan: PropertyVideoPlan, render?: DomaraVideoRenderResult): number[] {
  const sceneCount = plan.scenes.length;
  if (!sceneCount) return [];
  if (!render || render.sceneCount <= 0 || render.durationSeconds <= 0) {
    return plan.scenes.map((scene) => Math.max(3, scene.durationSeconds));
  }

  const total = plan.scenes.reduce((sum, scene) => sum + Math.max(3, scene.durationSeconds), 0);
  if (total <= 0) {
    return plan.scenes.map(() => Math.max(3, Math.round(render.durationSeconds / sceneCount)));
  }

  return plan.scenes.map((scene) => {
    const share = Math.max(3, Math.round((Math.max(3, scene.durationSeconds) / total) * render.durationSeconds));
    return share;
  });
}

function toTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolveLocationLabel(input: PropertyListingInput): string {
  return [input.city, input.region, input.country].filter(Boolean).join(", ") || input.country || "Italy";
}

function angleTitles(input: PropertyListingInput): DomaraTitleOption[] {
  const location = resolveLocationLabel(input);
  const price = input.price?.trim() || "Price Snapshot";
  const titleBase = input.title.trim() || "European Property Tour";

  return [
    { angle: "lifestyle", title: `Would You Move to This Home in ${location}?` },
    { angle: "investment", title: `${titleBase} in ${location}: Smart Long-Term Play?` },
    { angle: "second_home", title: `Could This Be Your European Second Home in ${location}?` },
    { angle: "hidden_gem", title: `A Hidden Gem in ${location} You Should See` },
    { angle: "deal_spotlight", title: `${location} Deal Spotlight: ${price}` },
    { angle: "expat_relocation", title: `Expat Relocation Tour: Living in ${location}` },
    { angle: "under_budget", title: `${location} Property Tour Under Budget? ${price}` },
  ];
}

function buildDescription(params: {
  plan: PropertyVideoPlan;
  input: PropertyListingInput;
  chapters: DomaraChapter[];
  sourceAttribution: string;
}): string {
  const location = resolveLocationLabel(params.input);
  const summary = [
    `${params.input.title || params.plan.youtubeTitle}`,
    params.input.price ? `Price: ${params.input.price}` : null,
    params.input.propertyType ? `Type: ${params.input.propertyType}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    `Explore this Expat AI property story in ${location}.`,
    summary,
    "",
    "Chapters:",
    ...params.chapters.map((chapter) => `${chapter.timestamp} ${chapter.title}`),
    "",
    "Source attribution:",
    params.sourceAttribution,
    "",
    "CTA:",
    "Follow Expat AI for more European property storytelling and weekly location deep-dives.",
    "",
    "Disclaimer:",
    "Editorial content only. This video is not financial or investment advice.",
  ].join("\n");
}

export function generateDomaraYouTubePackage(params: {
  plan: PropertyVideoPlan;
  listingInput: PropertyListingInput;
  renderResult?: DomaraVideoRenderResult;
}): DomaraYouTubePackage {
  const { plan, listingInput, renderResult } = params;
  const sourceAttribution = [listingInput.source || "Manual source", listingInput.listingUrl || "Listing URL pending"]
    .filter(Boolean)
    .join(" | ");
  const chapterDurations = clampSceneDurations(plan, renderResult);
  let elapsed = 0;
  const chapters: DomaraChapter[] = plan.scenes.map((scene, index) => {
    const chapter = {
      timestamp: toTimestamp(elapsed),
      title: scene.title,
    };
    elapsed += chapterDurations[index] || scene.durationSeconds;
    return chapter;
  });

  const titles = angleTitles(listingInput);
  const recommendedTitle = titles[0]?.title || plan.youtubeTitle;
  const description = buildDescription({
    plan,
    input: listingInput,
    chapters,
    sourceAttribution,
  });

  const tags = [
    "Expat AI",
    "European property",
    "Italy real estate",
    listingInput.city || "European lifestyle",
    listingInput.propertyType || "property tour",
  ].filter(Boolean);

  const hashtags = ["#ExpatAI", "#PropertyTour", "#EuropeanLifestyle", "#ItalyHomes", "#Relocation"].slice(0, 5);

  const shortsIdeas: DomaraShortsIdea[] = plan.scenes.slice(0, 5).map((scene) => ({
    hook: `${scene.title}: Could you live here?`,
    sourceSceneTitle: scene.title,
    captionDraft: `${scene.overlayText} | Full tour on Expat AI.`,
    titleDraft: `${scene.title} in 30 Seconds | Expat AI`,
  }));

  return {
    finalRecommendedTitle: recommendedTitle,
    titleVariants: titles,
    description,
    tags,
    hashtags,
    chapters,
    pinnedComment:
      "Which city should Expat AI cover next? Drop your pick below and we will add it to the next publishing batch.",
    thumbnailIdeas: [
      {
        text: "Would You Live Here?",
        visualDirection: "Hero facade frame + clean price lockup + Expat AI badge",
      },
      {
        text: "Italy Hidden Gem",
        visualDirection: "Interior wide shot + warm cinematic grade + location ribbon",
      },
      {
        text: "Second Home Tour",
        visualDirection: "Map + lifestyle split frame + CTA arrow",
      },
    ],
    shortsIdeas,
    contentAngleVariants: [
      "lifestyle",
      "investment",
      "second_home",
      "hidden_gem",
      "deal_spotlight",
      "expat_relocation",
      "under_budget",
    ],
    metadata: {
      sourceAttribution,
      mapAttribution: renderResult?.mapAttribution,
      complianceNote: "No promissory investment claims or return assurances.",
      generatedAt: new Date().toISOString(),
      renderLinked: Boolean(renderResult?.downloadUrl),
    },
  };
}
