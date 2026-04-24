import { DomaraContentAngle, PropertyListingInput } from "@/lib/studio/domara/types";

export type DomaraBatchJobStatus =
  | "draft"
  | "ready"
  | "queued"
  | "generating_plan"
  | "rendering"
  | "complete"
  | "failed"
  | "ready_to_publish";

export type DomaraSeriesTemplateName =
  | "italy_under_300k"
  | "hidden_gems_tuscany"
  | "could_you_retire_here"
  | "european_second_homes"
  | "beach_homes_europe"
  | "best_expat_towns_italy";

export type DomaraBatchItem = {
  id: string;
  listing: PropertyListingInput;
  contentAngle: DomaraContentAngle;
  seriesTemplate: DomaraSeriesTemplateName;
  status: DomaraBatchJobStatus;
  error?: string;
};

export type DomaraBatch = {
  id: string;
  createdAt: string;
  items: DomaraBatchItem[];
  limit: number;
};

export type DomaraContentCalendarItem = {
  batchItemId: string;
  videoTitle: string;
  country: string;
  city?: string;
  contentAngle: DomaraContentAngle;
  seriesTemplate: DomaraSeriesTemplateName;
  status: DomaraBatchJobStatus;
  plannedPublishDate?: string;
  mp4Status: "not_rendered" | "ready" | "failed";
  youtubePackageStatus: "not_generated" | "ready";
};

export type DomaraSeriesTemplate = {
  name: DomaraSeriesTemplateName;
  label: string;
  titleStyle: string;
  scriptAngle: string;
  thumbnailConcept: string;
  ctaTone: string;
  defaultAngle: DomaraContentAngle;
};

export const DOMARA_BATCH_LIMIT = 5;

const SERIES_TEMPLATES: Record<DomaraSeriesTemplateName, DomaraSeriesTemplate> = {
  italy_under_300k: {
    name: "italy_under_300k",
    label: "Italy Under EUR 300K",
    titleStyle: "budget hook",
    scriptAngle: "value + livability",
    thumbnailConcept: "price lockup + location",
    ctaTone: "actionable",
    defaultAngle: "deal_spotlight",
  },
  hidden_gems_tuscany: {
    name: "hidden_gems_tuscany",
    label: "Hidden Gems in Tuscany",
    titleStyle: "discovery",
    scriptAngle: "lifestyle + local charm",
    thumbnailConcept: "sunset + old town",
    ctaTone: "curious",
    defaultAngle: "hidden_gem",
  },
  could_you_retire_here: {
    name: "could_you_retire_here",
    label: "Could You Retire Here?",
    titleStyle: "question-led",
    scriptAngle: "practicality + comfort",
    thumbnailConcept: "lifestyle day-in-life",
    ctaTone: "reflective",
    defaultAngle: "lifestyle",
  },
  european_second_homes: {
    name: "european_second_homes",
    label: "European Second Homes",
    titleStyle: "aspirational",
    scriptAngle: "weekend escape",
    thumbnailConcept: "interior + map pin",
    ctaTone: "premium",
    defaultAngle: "second_home",
  },
  beach_homes_europe: {
    name: "beach_homes_europe",
    label: "Beach Homes in Europe",
    titleStyle: "coastal escape",
    scriptAngle: "lifestyle + accessibility",
    thumbnailConcept: "sea view + price",
    ctaTone: "dreamy",
    defaultAngle: "lifestyle",
  },
  best_expat_towns_italy: {
    name: "best_expat_towns_italy",
    label: "Best Expat Towns in Italy",
    titleStyle: "relocation",
    scriptAngle: "relocation practicality",
    thumbnailConcept: "town map + streets",
    ctaTone: "guidance",
    defaultAngle: "lifestyle",
  },
};

function stableId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `batch-${Math.abs(hash).toString(16)}`;
}

export function listSeriesTemplates(): DomaraSeriesTemplate[] {
  return Object.values(SERIES_TEMPLATES);
}

export function applySeriesTemplate(
  listing: PropertyListingInput,
  templateName: DomaraSeriesTemplateName,
): { listing: PropertyListingInput; contentAngle: DomaraContentAngle } {
  const template = SERIES_TEMPLATES[templateName];
  const contentAngle = listing.contentAngle || template.defaultAngle;
  return {
    listing,
    contentAngle,
  };
}

export function createDomaraBatch(listings: PropertyListingInput[], templateName: DomaraSeriesTemplateName): DomaraBatch {
  const limited = listings.slice(0, DOMARA_BATCH_LIMIT);
  const items = limited.map((listing, index) => {
    const applied = applySeriesTemplate(listing, templateName);
    return {
      id: stableId(`${listing.title}|${listing.listingUrl || "manual"}|${index}`),
      listing: applied.listing,
      contentAngle: applied.contentAngle,
      seriesTemplate: templateName,
      status: "draft" as const,
    };
  });

  return {
    id: stableId(`${templateName}|${items.length}|${new Date().toISOString().slice(0, 10)}`),
    createdAt: new Date().toISOString(),
    items,
    limit: DOMARA_BATCH_LIMIT,
  };
}

export function transitionBatchItemStatus(
  item: DomaraBatchItem,
  nextStatus: DomaraBatchJobStatus,
  error?: string,
): DomaraBatchItem {
  return {
    ...item,
    status: nextStatus,
    error,
  };
}

export function generateContentCalendar(batch: DomaraBatch): DomaraContentCalendarItem[] {
  return batch.items.map((item, index) => ({
    batchItemId: item.id,
    videoTitle: item.listing.title,
    country: item.listing.country,
    city: item.listing.city,
    contentAngle: item.contentAngle,
    seriesTemplate: item.seriesTemplate,
    status: item.status,
    plannedPublishDate: new Date(Date.now() + index * 86400000).toISOString().slice(0, 10),
    mp4Status: item.status === "complete" || item.status === "ready_to_publish" ? "ready" : "not_rendered",
    youtubePackageStatus: item.status === "ready_to_publish" ? "ready" : "not_generated",
  }));
}

export type DomaraBulkExportManifest = {
  generatedAt: string;
  count: number;
  items: Array<{
    batchItemId: string;
    title: string;
    status: DomaraBatchJobStatus;
    listingUrl?: string;
    country: string;
    city?: string;
    contentAngle: DomaraContentAngle;
    seriesTemplate: DomaraSeriesTemplateName;
  }>;
};

export function buildBulkExportManifest(batch: DomaraBatch): DomaraBulkExportManifest {
  return {
    generatedAt: new Date().toISOString(),
    count: batch.items.length,
    items: batch.items.map((item) => ({
      batchItemId: item.id,
      title: item.listing.title,
      status: item.status,
      listingUrl: item.listing.listingUrl,
      country: item.listing.country,
      city: item.listing.city,
      contentAngle: item.contentAngle,
      seriesTemplate: item.seriesTemplate,
    })),
  };
}
