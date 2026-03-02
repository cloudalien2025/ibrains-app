const bucket = new Map<string, number[]>();

function prune(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((ts) => now - ts <= windowMs);
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = prune(bucket.get(key) ?? [], windowMs, now);
  if (current.length >= limit) {
    bucket.set(key, current);
    return false;
  }
  current.push(now);
  bucket.set(key, current);
  return true;
}
