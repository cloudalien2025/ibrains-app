export type DomaraImageValidation = {
  acceptedUrls: string[];
  skippedUrls: string[];
  warnings: string[];
};

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function isPrivateIpv4Host(hostname: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isPrivateIpv6Host(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function isDisallowedHost(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  return (
    lowered === "localhost" ||
    lowered === "0.0.0.0" ||
    lowered.endsWith(".local") ||
    lowered.endsWith(".internal") ||
    lowered.endsWith(".localhost") ||
    isPrivateIpv4Host(lowered) ||
    isPrivateIpv6Host(lowered)
  );
}

export function validateDomaraImageUrls(rawUrls: string[]): DomaraImageValidation {
  const acceptedUrls: string[] = [];
  const skippedUrls: string[] = [];
  const warnings: string[] = [];

  for (const candidate of rawUrls) {
    const value = candidate.trim();
    if (!value) continue;

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        skippedUrls.push(value);
        warnings.push(`Skipped image (unsupported protocol): ${value}`);
        continue;
      }

      if (isDisallowedHost(parsed.hostname)) {
        skippedUrls.push(value);
        warnings.push(`Skipped image (private or local host): ${value}`);
        continue;
      }

      acceptedUrls.push(value);
    } catch {
      skippedUrls.push(value);
      warnings.push(`Skipped image (invalid URL): ${value}`);
    }
  }

  return {
    acceptedUrls,
    skippedUrls,
    warnings,
  };
}
