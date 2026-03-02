export type PromptPackRecord = {
  id: string;
  pack_name: string;
  version: string;
  build_date: string;
  sha256: string;
  canonicalization_rules: string[];
  created_at?: string;
};

export type PromptRecord = {
  id?: string;
  pack_id: string;
  dimension: string;
  system_prompt: string;
  user_prompt: string;
  flags_vocabulary: string[];
  created_at?: string;
};

export type PromptPackInput = {
  pack: string;
  ssc_prompt_pack_version: string;
  ssc_prompt_pack_build_date: string;
  ssc_prompt_pack_sha256: string;
  canonicalization_rules?: string[];
  dimensions: Array<{
    dimension: string;
    system: string;
    user: string;
    flags_vocabulary?: string[];
  }>;
};

export type ScorePayload = {
  dimension: string;
  score: number;
  reasons: Array<{
    title: string;
    explanation: string;
    quote: string | null;
  }>;
  flags: string[];
};

export type StoryboardRunRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  url: string;
  screenshot_full_key: string;
  visible_text_key: string;
  created_at?: string;
};

export type StoryboardScoreRecord = {
  id?: string;
  run_id: string;
  dimension: string;
  score_json: ScorePayload;
  created_at?: string;
};
