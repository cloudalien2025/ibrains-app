export type BlogSupportStatus = {
  enabled: boolean;
  reason: string;
};

export function getBlogSupportStatus(): BlogSupportStatus {
  return {
    enabled: false,
    reason: "Blog generation is intentionally not enabled in DirectoryIQ v1 listing upgrade flow.",
  };
}
