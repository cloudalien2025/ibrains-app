import "server-only";

import { buildShopifyOnlineStoreProductUrl } from "@/lib/ecomviper/shopify/shopify-domain";
import { runShopifyGraphqlRequest, detectShopifyMissingScope } from "@/lib/ecomviper/shopify/shopify-client";
import {
  getShopifyAdminCredentialsForUser,
} from "@/lib/ecomviper/shopify/shopify-connection";
import {
  markShopifyImportFailure,
  replacePersistedShopifyProducts,
  getPersistedShopifyImportState,
  listPersistedShopifyProducts,
} from "@/lib/ecomviper/shopify/shopify-product-repository";
import type {
  ShopifyImageRecord,
  ShopifyImportResult,
  ShopifyProductRecord,
  ShopifyVariantRecord,
  ShopifyImportState,
} from "@/lib/ecomviper/shopify/shopify-types";

const SHOPIFY_IMPORT_PAGE_SIZE = 50;
const SHOPIFY_IMPORT_MAX_PAGES = 20;
const SHOPIFY_IMPORT_MAX_PAGES_BOUNDED = 4;

interface ShopifyImportOptions {
  boundedRuntime?: boolean;
  maxPages?: number;
}

interface ShopifyProductsPageData {
  products?: {
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    };
    nodes?: unknown[];
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeHttpsUrl(value: unknown): string {
  const candidate = asString(value);
  if (!candidate) return "";

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function dedupeUrls(values: unknown[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const nested of value) {
        for (const entry of dedupeUrls([nested])) {
          if (!seen.has(entry)) {
            seen.add(entry);
            output.push(entry);
          }
        }
      }
      continue;
    }

    const record = asRecord(value);
    if (record) {
      const fromRecord = dedupeUrls([
        record.url,
        record.src,
        record.imageUrl,
        record.href,
      ]);
      for (const entry of fromRecord) {
        if (!seen.has(entry)) {
          seen.add(entry);
          output.push(entry);
        }
      }
      continue;
    }

    const normalized = normalizeHttpsUrl(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function parseGraphqlMoney(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  return Number(parsed.toFixed(2));
}

function normalizeSelectedOptions(value: unknown): ShopifyVariantRecord["selectedOptions"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      name: asString(entry.name),
      value: asString(entry.value),
    }))
    .filter((entry) => entry.name.length > 0 || entry.value.length > 0);
}

function normalizeGalleryImages(params: {
  featuredImage: Record<string, unknown> | null;
  mediaNodes: unknown[];
  variants: ShopifyVariantRecord[];
}): {
  primaryImageUrl: string;
  galleryImageUrls: string[];
  galleryImages: ShopifyImageRecord[];
} {
  const galleryImages: ShopifyImageRecord[] = [];

  const featuredUrl = normalizeHttpsUrl(params.featuredImage?.url);
  if (featuredUrl) {
    galleryImages.push({
      id: asString(params.featuredImage?.id) || `shopify_featured_${featuredUrl}`,
      url: featuredUrl,
      altText: asString(params.featuredImage?.altText) || null,
      width: asNumber(params.featuredImage?.width),
      height: asNumber(params.featuredImage?.height),
      source: "product",
      variantId: null,
    });
  }

  for (const mediaNode of params.mediaNodes) {
    const mediaRecord = asRecord(mediaNode);
    if (!mediaRecord) continue;
    const imageNode = asRecord(mediaRecord.image);
    if (!imageNode) continue;

    const url = normalizeHttpsUrl(imageNode.url);
    if (!url) continue;

    galleryImages.push({
      id: asString(mediaRecord.id) || asString(imageNode.id) || `shopify_media_${url}`,
      url,
      altText: asString(imageNode.altText) || null,
      width: asNumber(imageNode.width),
      height: asNumber(imageNode.height),
      source: "product",
      variantId: null,
    });
  }

  for (const variant of params.variants) {
    if (!variant.imageUrl) continue;
    galleryImages.push({
      id: `shopify_variant_${variant.id}`,
      url: variant.imageUrl,
      altText: variant.imageAltText,
      width: null,
      height: null,
      source: "variant",
      variantId: variant.id,
    });
  }

  const dedupedUrls = dedupeUrls(galleryImages.map((entry) => entry.url));
  const dedupedImages = dedupedUrls.map((url) => {
    const first = galleryImages.find((entry) => entry.url === url);
    return (
      first ?? {
        id: `shopify_image_${url}`,
        url,
        altText: null,
        width: null,
        height: null,
        source: "product" as const,
        variantId: null,
      }
    );
  });

  return {
    primaryImageUrl: dedupedUrls[0] ?? "",
    galleryImageUrls: dedupedUrls,
    galleryImages: dedupedImages,
  };
}

function normalizeVariant(node: Record<string, unknown>, productId: string): ShopifyVariantRecord | null {
  const id = asString(node.id);
  if (!id) return null;

  const imageRecord = asRecord(node.image);
  const imageUrl = normalizeHttpsUrl(imageRecord?.url);
  const imageUrls = dedupeUrls([imageUrl]);

  return {
    id,
    productId,
    title: asString(node.title),
    sku: asString(node.sku),
    barcode: asString(node.barcode),
    price: parseGraphqlMoney(node.price),
    compareAtPrice: parseGraphqlMoney(node.compareAtPrice),
    inventoryQuantity: asNumber(node.inventoryQuantity),
    selectedOptions: normalizeSelectedOptions(node.selectedOptions),
    imageUrl,
    imageAltText: asString(imageRecord?.altText) || null,
    imageUrls,
  };
}

function normalizeProductNode(node: Record<string, unknown>, storeDomain: string): ShopifyProductRecord | null {
  const id = asString(node.id);
  if (!id) return null;

  const variantsConnection = asRecord(node.variants);
  const variantNodes = Array.isArray(variantsConnection?.nodes) ? variantsConnection?.nodes : [];
  const variants = variantNodes
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => normalizeVariant(entry, id))
    .filter((entry): entry is ShopifyVariantRecord => entry !== null);

  const mediaConnection = asRecord(node.media);
  const mediaNodes = Array.isArray(mediaConnection?.nodes) ? mediaConnection.nodes : [];
  const featuredImage = asRecord(node.featuredImage);

  const normalizedImages = normalizeGalleryImages({
    featuredImage,
    mediaNodes,
    variants,
  });

  const handle = asString(node.handle);
  const onlineStoreUrl =
    normalizeHttpsUrl(node.onlineStoreUrl) ||
    buildShopifyOnlineStoreProductUrl(storeDomain, handle);

  const descriptionHtml = asString(node.descriptionHtml);

  return {
    id,
    storeDomain,
    title: asString(node.title),
    handle,
    vendor: asString(node.vendor),
    productType: asString(node.productType),
    status: asString(node.status),
    tags: Array.isArray(node.tags)
      ? node.tags.map((entry) => asString(entry)).filter((entry) => entry.length > 0)
      : [],
    description: asString(node.description),
    descriptionHtml,
    onlineStoreUrl,
    primaryImageUrl: normalizedImages.primaryImageUrl,
    galleryImageUrls: normalizedImages.galleryImageUrls,
    galleryImages: normalizedImages.galleryImages,
    createdAt: asString(node.createdAt) || new Date().toISOString(),
    updatedAt: asString(node.updatedAt) || new Date().toISOString(),
    variants,
  };
}

function countUniqueImages(products: ShopifyProductRecord[]): number {
  const seen = new Set<string>();
  for (const product of products) {
    for (const url of product.galleryImageUrls) {
      if (!url) continue;
      seen.add(url);
    }
  }
  return seen.size;
}

const SHOPIFY_PRODUCTS_QUERY = `#graphql
  query ShopifyProductsForEcomViper($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        vendor
        productType
        status
        tags
        description
        descriptionHtml
        onlineStoreUrl
        createdAt
        updatedAt
        featuredImage {
          id
          url
          altText
          width
          height
        }
        media(first: 50) {
          nodes {
            ... on MediaImage {
              id
              image {
                id
                url
                altText
                width
                height
              }
            }
          }
        }
        variants(first: 100) {
          nodes {
            id
            title
            sku
            barcode
            price
            compareAtPrice
            inventoryQuantity
            selectedOptions {
              name
              value
            }
            image {
              id
              url
              altText
              width
              height
            }
          }
        }
      }
    }
  }
`;

export async function importShopifyProductsForUser(
  userId: string,
  options?: ShopifyImportOptions
): Promise<ShopifyImportResult> {
  const credentials = await getShopifyAdminCredentialsForUser(userId);
  if (!credentials.connected || !credentials.storeDomain || !credentials.adminApiToken) {
    const message = "Connect Shopify (store domain + Admin API token) before importing products.";
    try {
      await markShopifyImportFailure({ userId, message });
    } catch {
      // Non-fatal in environments where Shopify import state persistence is unavailable.
    }
    throw new Error(message);
  }

  const maxPages = options?.boundedRuntime
    ? Math.max(1, Math.min(options?.maxPages ?? SHOPIFY_IMPORT_MAX_PAGES_BOUNDED, SHOPIFY_IMPORT_MAX_PAGES))
    : Math.max(1, options?.maxPages ?? SHOPIFY_IMPORT_MAX_PAGES);

  const productsById = new Map<string, ShopifyProductRecord>();
  let hasNextPage = true;
  let afterCursor: string | null = null;
  let pageCount = 0;
  let fetchedNodeCount = 0;

  while (hasNextPage && pageCount < maxPages) {
    const pageResponse: Awaited<
      ReturnType<typeof runShopifyGraphqlRequest<ShopifyProductsPageData>>
    > = await runShopifyGraphqlRequest<ShopifyProductsPageData>({
      storeDomain: credentials.storeDomain,
      adminApiToken: credentials.adminApiToken,
      apiVersion: credentials.apiVersion,
      query: SHOPIFY_PRODUCTS_QUERY,
      variables: {
        first: SHOPIFY_IMPORT_PAGE_SIZE,
        after: afterCursor,
      },
    });

    if (!pageResponse.ok) {
      if (detectShopifyMissingScope(pageResponse.payload.errors)) {
        const message = "Shopify token is missing required scope: read_products.";
        try {
          await markShopifyImportFailure({ userId, message });
        } catch {
          // Non-fatal in environments where Shopify import state persistence is unavailable.
        }
        throw new Error(message);
      }

      const message = pageResponse.errorMessage ?? "Shopify product import failed.";
      try {
        await markShopifyImportFailure({ userId, message });
      } catch {
        // Non-fatal in environments where Shopify import state persistence is unavailable.
      }
      throw new Error(message);
    }

    const productsConnection = pageResponse.payload.data?.products;
    const productNodes = Array.isArray(productsConnection?.nodes) ? productsConnection.nodes : [];
    fetchedNodeCount += productNodes.length;

    for (const productNode of productNodes) {
      const record = asRecord(productNode);
      if (!record) continue;
      const normalized = normalizeProductNode(record, credentials.storeDomain);
      if (!normalized) continue;
      productsById.set(normalized.id, normalized);
    }

    const pageInfo = productsConnection?.pageInfo ?? {};
    hasNextPage = Boolean(pageInfo.hasNextPage);
    afterCursor = asString(pageInfo.endCursor) || null;
    pageCount += 1;

    if (!afterCursor) {
      hasNextPage = false;
    }
  }

  const importedAt = new Date().toISOString();
  const products = Array.from(productsById.values());
  const imageCount = countUniqueImages(products);

  await replacePersistedShopifyProducts({
    userId,
    products,
    importedAt,
    importStatus: "success",
    importMessage: `Imported ${products.length} Shopify products.`,
  });

  return {
    importedCount: products.length,
    imageCount,
    pageCount,
    hasNextPage,
    fetchedNodeCount,
    lastImportAt: importedAt,
    diagnostics: {
      importedCount: products.length,
      imageCount,
      pageCount,
      hasNextPage,
      fetchedNodeCount,
      diagnosticsEventProductsImported: "shopify_products_imported",
      diagnosticsEventImagesImported: "shopify_images_imported",
    },
  };
}

export async function listShopifyProductsForUser(userId: string): Promise<ShopifyProductRecord[]> {
  return listPersistedShopifyProducts(userId);
}

export async function getShopifyImportStateForUser(userId: string): Promise<ShopifyImportState> {
  return getPersistedShopifyImportState(userId);
}
