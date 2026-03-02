export type BrainId = "directoryiq" | "ecomviper";

export type CrawlStage =
  | "idle"
  | "discovering_sitemap"
  | "parsing_sitemaps"
  | "fetching_pages"
  | "extracting_signals"
  | "building_snapshot"
  | "completed"
  | "error";

export type SitemapUrlEntry = {
  url: string;
  lastmod: string | null;
};

export type SurfaceType = "product" | "blog" | "category" | "listing_like" | "page" | "unknown";

export type ExtractedPageSignals = {
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  jsonldBlobs: Array<Record<string, unknown>>;
  outboundInternalLinks: string[];
  extractedText: string | null;
  canonicalUrl: string | null;
};

export type CrawlSurfaceResult = {
  url: string;
  lastmod: string | null;
  type: SurfaceType;
  signals: ExtractedPageSignals | null;
};
