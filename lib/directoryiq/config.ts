const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const directoryIqConfig = {
  serpApiKey: process.env.SERPAPI_API_KEY ?? "",
  serpCacheTtlDays: toInt(process.env.DIRECTORYIQ_SERP_CACHE_TTL_DAYS, 14),
  serpMaxConcurrency: toInt(process.env.DIRECTORYIQ_SERP_MAX_CONCURRENCY, 3),
  serpFetchTimeoutMs: toInt(process.env.DIRECTORYIQ_SERP_FETCH_TIMEOUT_MS, 12_000),
  dataRoot: process.env.DIRECTORYIQ_DATA_ROOT ?? "/opt/brains-data/brains/brilliant_directories",
};

export const serpCacheFile = `${directoryIqConfig.dataRoot}/serp_cache/cache.json`;
export const draftsFile = `${directoryIqConfig.dataRoot}/drafts/drafts.json`;
