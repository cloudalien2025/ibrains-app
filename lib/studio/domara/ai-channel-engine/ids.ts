export function stableCasaHudHash(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function stableCasaHudId(prefix: string, seed: string): string {
  return `${prefix}-${stableCasaHudHash(seed).slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
