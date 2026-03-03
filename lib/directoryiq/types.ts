export type SerpStatus = "QUEUED" | "RUNNING" | "READY" | "FAILED";

export type SerpTopResult = {
  position: number;
  title: string;
  link: string;
  snippet: string;
};

export type ExtractedOutlineItem = {
  url: string;
  pageTitle: string;
  h1: string;
  h2: string[];
  h3: string[];
  wordCount: number;
};

export type ConsensusOutline = {
  h2Sections: Array<{ heading: string; score: number; avgPosition: number; h3: string[] }>;
  mustCoverQuestions: string[];
  targetLengthBand: { min: number; median: number; max: number };
};

export type SerpCacheEntry = {
  id: string;
  listing_id: string;
  slot_id: string;
  focus_keyword: string;
  location_modifier: string | null;
  serp_query_used: string;
  status: SerpStatus;
  top_results: SerpTopResult[];
  extracted_outline: ExtractedOutlineItem[];
  consensus_outline: ConsensusOutline | null;
  content_deltas: string[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type BlogDraft = {
  draft_id: string;
  listing_id: string;
  slot_id: string;
  post_title: string;
  focus_keyword: string;
  slug: string;
  article_markdown: string;
  seo_title: string;
  meta_description: string;
  serp_outline_used: boolean;
  serp_cache_id: string | null;
  title_alternates: string[];
  created_at: string;
  updated_at: string;
};

export type EnqueueInput = {
  listing_id: string;
  slot_id: string;
  focus_keyword: string;
  location_modifier?: string | null;
};

export type ListingData = {
  listing_id: string;
  slot_id: string;
  business_name: string;
  city?: string;
  state?: string;
  listing_url: string;
  service_summary?: string;
};
