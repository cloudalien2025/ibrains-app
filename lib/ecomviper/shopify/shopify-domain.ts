const SHOPIFY_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
const SHOPIFY_STORE_HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const GENERIC_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-.]{0,251}[a-z0-9])?$/;

export function allowsCustomShopifyDomains(): boolean {
  const raw = process.env.ECOMVIPER_SHOPIFY_ALLOW_CUSTOM_DOMAIN?.trim().toLowerCase() ?? "";
  return raw === "1" || raw === "true" || raw === "yes";
}

export function normalizeShopifyStoreDomain(input: string, options?: { allowCustomDomain?: boolean }): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const allowCustomDomain = options?.allowCustomDomain ?? allowsCustomShopifyDomains();
  const normalizedRaw =
    !raw.includes("://") &&
    !raw.includes(".") &&
    SHOPIFY_STORE_HANDLE_PATTERN.test(raw)
      ? `${raw}.myshopify.com`
      : raw;

  const candidate = normalizedRaw.includes("://") ? normalizedRaw : `https://${normalizedRaw}`;

  let hostname = "";
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return null;
    if (parsed.username || parsed.password) return null;
    hostname = parsed.hostname.trim().toLowerCase().replace(/\.+$/, "");
  } catch {
    return null;
  }

  if (!hostname) return null;

  if (allowCustomDomain) {
    return GENERIC_HOST_PATTERN.test(hostname) ? hostname : null;
  }

  if (!SHOPIFY_HOST_PATTERN.test(hostname)) return null;
  return hostname;
}

export function buildShopifyOnlineStoreProductUrl(storeDomain: string, handle: string): string {
  const normalizedHandle = handle.trim().replace(/^\/+/, "");
  if (!normalizedHandle) return "";
  return `https://${storeDomain}/products/${encodeURIComponent(normalizedHandle)}`;
}

export function normalizeDigitString(value: string): string {
  return value.replace(/\D+/g, "");
}

export function normalizeUpperTrimmed(value: string): string {
  return value.trim().toUpperCase();
}
