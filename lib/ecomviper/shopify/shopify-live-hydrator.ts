import "server-only";

import { runShopifyGraphqlRequest } from "@/lib/ecomviper/shopify/shopify-client";
import { resolveShopifyAccessTokenForUser } from "@/lib/ecomviper/shopify/shopify-connection";
import { buildShopifyOnlineStoreProductUrl } from "@/lib/ecomviper/shopify/shopify-domain";
import type {
  ShopifyImageRecord,
  ShopifyMetafieldRecord,
  ShopifyProductRecord,
  ShopifySelectedOption,
  ShopifyVariantRecord,
} from "@/lib/ecomviper/shopify/shopify-types";
import {
  buildShopifyEntitySourceProvenance,
  type ShopifyEntitySourceProvenance,
} from "@/lib/ecomviper/shopify/shopify-source-provenance";

interface ShopifyLiveCoreData {
  shop?: unknown;
  products?: unknown;
  collections?: unknown;
}

interface ShopifyLiveContentData {
  pages?: unknown;
  blogs?: unknown;
}

interface ShopifyLivePolicyNode {
  id: string;
  title: string;
  body: string;
  url: string;
}

export interface ShopifyLiveShopSummary {
  id: string;
  name: string;
  myshopifyDomain: string;
  email: string;
  description: string;
  primaryDomainUrl: string;
  primaryDomainHost: string;
}

export interface ShopifyLiveCollectionSummary {
  id: string;
  title: string;
  handle: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  onlineStoreUrl: string;
  updatedAt: string;
}

export interface ShopifyLivePageSummary {
  id: string;
  title: string;
  handle: string;
  body: string;
  updatedAt: string;
}

export interface ShopifyLiveBlogArticleSummary {
  id: string;
  blogId: string;
  blogTitle: string;
  title: string;
  handle: string;
  excerpt: string;
  contentHtml: string;
  publishedAt: string;
  updatedAt: string;
  onlineStoreUrl: string;
}

export interface ShopifyLiveHydrationResult {
  source: "live_shopify";
  fetchedAt: string;
  storeDomain: string;
  shop: ShopifyLiveShopSummary;
  products: ShopifyProductRecord[];
  collections: ShopifyLiveCollectionSummary[];
  pages: ShopifyLivePageSummary[];
  blogArticles: ShopifyLiveBlogArticleSummary[];
  policies: ShopifyLivePolicyNode[];
  rawPayload: {
    core: unknown;
    content: unknown;
  };
  warnings: string[];
  errors: string[];
  entitySourceProvenance: ShopifyEntitySourceProvenance[];
}

const CORE_QUERY = `#graphql
  query ShopifyLiveWorkspaceCore($productsFirst: Int!, $collectionsFirst: Int!) {
    shop {
      id
      name
      myshopifyDomain
      email
      description
      primaryDomain {
        url
        host
      }
      privacyPolicy {
        id
        title
        body
        url
      }
      refundPolicy {
        id
        title
        body
        url
      }
      shippingPolicy {
        id
        title
        body
        url
      }
      termsOfService {
        id
        title
        body
        url
      }
    }
    products(first: $productsFirst, sortKey: UPDATED_AT) {
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
        seo {
          title
          description
        }
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
        images(first: 100) {
          nodes {
            id
            url
            altText
            width
            height
          }
        }
        media(first: 40) {
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
        metafields(first: 25) {
          nodes {
            id
            namespace
            key
            type
            value
            description
          }
        }
      }
    }
    collections(first: $collectionsFirst, sortKey: UPDATED_AT) {
      nodes {
        id
        title
        handle
        description
        seo {
          title
          description
        }
        onlineStoreUrl
        updatedAt
      }
    }
  }
`;

const CONTENT_QUERY = `#graphql
  query ShopifyLiveWorkspaceContent($pagesFirst: Int!, $blogsFirst: Int!, $articlesFirst: Int!) {
    pages(first: $pagesFirst, sortKey: UPDATED_AT) {
      nodes {
        id
        title
        handle
        body
        updatedAt
      }
    }
    blogs(first: $blogsFirst, sortKey: UPDATED_AT) {
      nodes {
        id
        title
        handle
        articles(first: $articlesFirst, sortKey: UPDATED_AT) {
          nodes {
            id
            title
            handle
            excerpt
            contentHtml
            publishedAt
            updatedAt
            onlineStoreUrl
          }
        }
      }
    }
  }
`;

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

function normalizeSelectedOptions(value: unknown): ShopifySelectedOption[] {
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

function normalizeMetafields(value: unknown): ShopifyMetafieldRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      id: asString(entry.id),
      namespace: asString(entry.namespace),
      key: asString(entry.key),
      type: asString(entry.type),
      value: asString(entry.value),
      description: asString(entry.description) || null,
    }))
    .filter((entry) => entry.namespace.length > 0 && entry.key.length > 0);
}

function parseGraphqlMoney(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  return Number(parsed.toFixed(2));
}

function normalizeVariant(node: Record<string, unknown>, productId: string): ShopifyVariantRecord | null {
  const id = asString(node.id);
  if (!id) return null;

  const imageRecord = asRecord(node.image);
  const imageUrl = normalizeHttpsUrl(imageRecord?.url);

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
    imageUrls: dedupeUrls([imageUrl]),
  };
}

function normalizeGalleryImages(params: {
  featuredImage: Record<string, unknown> | null;
  imageNodes: unknown[];
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

  for (const imageNodeRaw of params.imageNodes) {
    const imageNode = asRecord(imageNodeRaw);
    if (!imageNode) continue;

    const url = normalizeHttpsUrl(imageNode.url);
    if (!url) continue;

    galleryImages.push({
      id: asString(imageNode.id) || `shopify_image_${url}`,
      url,
      altText: asString(imageNode.altText) || null,
      width: asNumber(imageNode.width),
      height: asNumber(imageNode.height),
      source: "product",
      variantId: null,
    });
  }

  for (const mediaNodeRaw of params.mediaNodes) {
    const mediaNode = asRecord(mediaNodeRaw);
    if (!mediaNode) continue;
    const imageNode = asRecord(mediaNode.image);
    if (!imageNode) continue;

    const url = normalizeHttpsUrl(imageNode.url);
    if (!url) continue;

    galleryImages.push({
      id: asString(mediaNode.id) || asString(imageNode.id) || `shopify_media_${url}`,
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
  const imagesConnection = asRecord(node.images);
  const imageNodes = Array.isArray(imagesConnection?.nodes) ? imagesConnection.nodes : [];
  const featuredImage = asRecord(node.featuredImage);

  const normalizedImages = normalizeGalleryImages({
    featuredImage,
    imageNodes,
    mediaNodes,
    variants,
  });

  const seo = asRecord(node.seo);
  const metafieldsConnection = asRecord(node.metafields);
  const metafields = normalizeMetafields(
    Array.isArray(metafieldsConnection?.nodes) ? metafieldsConnection?.nodes : []
  );

  const handle = asString(node.handle);
  const onlineStoreUrl =
    normalizeHttpsUrl(node.onlineStoreUrl) ||
    buildShopifyOnlineStoreProductUrl(storeDomain, handle);

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
    descriptionHtml: asString(node.descriptionHtml),
    seoTitle: asString(seo?.title),
    seoDescription: asString(seo?.description),
    metafields,
    onlineStoreUrl,
    primaryImageUrl: normalizedImages.primaryImageUrl,
    galleryImageUrls: normalizedImages.galleryImageUrls,
    galleryImages: normalizedImages.galleryImages,
    createdAt: asString(node.createdAt) || new Date().toISOString(),
    updatedAt: asString(node.updatedAt) || new Date().toISOString(),
    variants,
  };
}

function normalizePolicies(shopRecord: Record<string, unknown> | null): ShopifyLivePolicyNode[] {
  if (!shopRecord) return [];

  const policyKeys = ["privacyPolicy", "refundPolicy", "shippingPolicy", "termsOfService"] as const;
  const policies: ShopifyLivePolicyNode[] = [];

  for (const key of policyKeys) {
    const node = asRecord(shopRecord[key]);
    if (!node) continue;

    const id = asString(node.id) || `shopify_policy_${key}`;
    const title = asString(node.title);
    const body = asString(node.body);
    const url = normalizeHttpsUrl(node.url);

    if (!title && !body) continue;

    policies.push({
      id,
      title: title || key,
      body,
      url,
    });
  }

  return policies;
}

function normalizeShopSummary(shopRecord: Record<string, unknown> | null, fallbackStoreDomain: string): ShopifyLiveShopSummary {
  const primaryDomain = asRecord(shopRecord?.primaryDomain);
  const myshopifyDomain = asString(shopRecord?.myshopifyDomain) || fallbackStoreDomain;

  return {
    id: asString(shopRecord?.id) || "",
    name: asString(shopRecord?.name) || myshopifyDomain,
    myshopifyDomain,
    email: asString(shopRecord?.email),
    description: asString(shopRecord?.description),
    primaryDomainUrl: normalizeHttpsUrl(primaryDomain?.url),
    primaryDomainHost: asString(primaryDomain?.host),
  };
}

function normalizeCollections(value: unknown): ShopifyLiveCollectionSummary[] {
  const connection = asRecord(value);
  const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];

  return nodes
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => {
      const seo = asRecord(entry.seo);
      return {
        id: asString(entry.id),
        title: asString(entry.title),
        handle: asString(entry.handle),
        description: asString(entry.description),
        seoTitle: asString(seo?.title),
        seoDescription: asString(seo?.description),
        onlineStoreUrl: normalizeHttpsUrl(entry.onlineStoreUrl),
        updatedAt: asString(entry.updatedAt),
      };
    })
    .filter((entry) => entry.id.length > 0);
}

function normalizePages(value: unknown): ShopifyLivePageSummary[] {
  const connection = asRecord(value);
  const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];

  return nodes
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      id: asString(entry.id),
      title: asString(entry.title),
      handle: asString(entry.handle),
      body: asString(entry.body),
      updatedAt: asString(entry.updatedAt),
    }))
    .filter((entry) => entry.id.length > 0);
}

function normalizeBlogArticles(value: unknown): ShopifyLiveBlogArticleSummary[] {
  const connection = asRecord(value);
  const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];

  const rows: ShopifyLiveBlogArticleSummary[] = [];

  for (const blogNodeRaw of nodes) {
    const blogNode = asRecord(blogNodeRaw);
    if (!blogNode) continue;

    const blogId = asString(blogNode.id);
    const blogTitle = asString(blogNode.title);
    const articlesConnection = asRecord(blogNode.articles);
    const articleNodes = Array.isArray(articlesConnection?.nodes) ? articlesConnection.nodes : [];

    for (const articleNodeRaw of articleNodes) {
      const articleNode = asRecord(articleNodeRaw);
      if (!articleNode) continue;

      const id = asString(articleNode.id);
      if (!id) continue;

      rows.push({
        id,
        blogId,
        blogTitle,
        title: asString(articleNode.title),
        handle: asString(articleNode.handle),
        excerpt: asString(articleNode.excerpt),
        contentHtml: asString(articleNode.contentHtml),
        publishedAt: asString(articleNode.publishedAt),
        updatedAt: asString(articleNode.updatedAt),
        onlineStoreUrl: normalizeHttpsUrl(articleNode.onlineStoreUrl),
      });
    }
  }

  return rows;
}

function buildEntityProvenance(input: {
  fetchedAt: string;
  storeDomain: string;
  shop: ShopifyLiveShopSummary;
  products: ShopifyProductRecord[];
  collections: ShopifyLiveCollectionSummary[];
  pages: ShopifyLivePageSummary[];
  blogArticles: ShopifyLiveBlogArticleSummary[];
  policies: ShopifyLivePolicyNode[];
}): ShopifyEntitySourceProvenance[] {
  const entries: ShopifyEntitySourceProvenance[] = [
    buildShopifyEntitySourceProvenance({
      entityType: "shop",
      source: "live_shopify",
      fetchedAt: input.fetchedAt,
      storeDomain: input.storeDomain,
      rawId: input.shop.id,
      connectionId: "shopify_admin",
    }),
  ];

  for (const product of input.products) {
    entries.push(
      buildShopifyEntitySourceProvenance({
        entityType: "product",
        source: "live_shopify",
        fetchedAt: input.fetchedAt,
        storeDomain: input.storeDomain,
        rawId: product.id,
        connectionId: "shopify_admin",
      })
    );

    for (const variant of product.variants) {
      entries.push(
        buildShopifyEntitySourceProvenance({
          entityType: "variant",
          source: "live_shopify",
          fetchedAt: input.fetchedAt,
          storeDomain: input.storeDomain,
          rawId: variant.id,
          connectionId: "shopify_admin",
        })
      );
    }
  }

  for (const collection of input.collections) {
    entries.push(
      buildShopifyEntitySourceProvenance({
        entityType: "collection",
        source: "live_shopify",
        fetchedAt: input.fetchedAt,
        storeDomain: input.storeDomain,
        rawId: collection.id,
        connectionId: "shopify_admin",
      })
    );
  }

  for (const page of input.pages) {
    entries.push(
      buildShopifyEntitySourceProvenance({
        entityType: "page",
        source: "live_shopify",
        fetchedAt: input.fetchedAt,
        storeDomain: input.storeDomain,
        rawId: page.id,
        connectionId: "shopify_admin",
      })
    );
  }

  for (const article of input.blogArticles) {
    entries.push(
      buildShopifyEntitySourceProvenance({
        entityType: "blog_article",
        source: "live_shopify",
        fetchedAt: input.fetchedAt,
        storeDomain: input.storeDomain,
        rawId: article.id,
        connectionId: "shopify_admin",
      })
    );
  }

  for (const policy of input.policies) {
    entries.push(
      buildShopifyEntitySourceProvenance({
        entityType: "policy",
        source: "live_shopify",
        fetchedAt: input.fetchedAt,
        storeDomain: input.storeDomain,
        rawId: policy.id,
        connectionId: "shopify_admin",
      })
    );
  }

  return entries;
}

export async function hydrateShopifyLiveWorkspaceForUser(input: {
  userId: string;
  productsFirst?: number;
  collectionsFirst?: number;
  pagesFirst?: number;
  blogsFirst?: number;
  articlesFirst?: number;
}): Promise<ShopifyLiveHydrationResult> {
  const access = await resolveShopifyAccessTokenForUser(input.userId);
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  const coreResponse = await runShopifyGraphqlRequest<ShopifyLiveCoreData>({
    storeDomain: access.storeDomain,
    accessToken: access.accessToken,
    apiVersion: access.apiVersion,
    query: CORE_QUERY,
    variables: {
      productsFirst: Math.max(1, Math.min(input.productsFirst ?? 80, 200)),
      collectionsFirst: Math.max(1, Math.min(input.collectionsFirst ?? 80, 200)),
    },
  });

  const coreData = coreResponse.payload.data;
  if (!coreResponse.ok && !coreData) {
    throw new Error(coreResponse.errorMessage ?? "Shopify live hydration failed while loading store/product data.");
  }

  if (!coreResponse.ok && coreResponse.errorMessage) {
    warnings.push(`Shopify core hydration warning: ${coreResponse.errorMessage}`);
  }

  const shopRecord = asRecord(coreData?.shop);
  const productsConnection = asRecord(coreData?.products);
  const productNodes = Array.isArray(productsConnection?.nodes) ? productsConnection.nodes : [];

  const products = productNodes
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => normalizeProductNode(entry, access.storeDomain))
    .filter((entry): entry is ShopifyProductRecord => entry !== null);

  const collections = normalizeCollections(coreData?.collections);
  const policies = normalizePolicies(shopRecord);
  const shop = normalizeShopSummary(shopRecord, access.storeDomain);

  const contentResponse = await runShopifyGraphqlRequest<ShopifyLiveContentData>({
    storeDomain: access.storeDomain,
    accessToken: access.accessToken,
    apiVersion: access.apiVersion,
    query: CONTENT_QUERY,
    variables: {
      pagesFirst: Math.max(1, Math.min(input.pagesFirst ?? 50, 100)),
      blogsFirst: Math.max(1, Math.min(input.blogsFirst ?? 20, 50)),
      articlesFirst: Math.max(1, Math.min(input.articlesFirst ?? 20, 50)),
    },
  });

  const contentData = contentResponse.payload.data;
  if (!contentResponse.ok && contentResponse.errorMessage) {
    warnings.push(`Shopify content hydration warning: ${contentResponse.errorMessage}`);
  }

  const pages = normalizePages(contentData?.pages);
  const blogArticles = normalizeBlogArticles(contentData?.blogs);

  if (!products.length) {
    errors.push("No live Shopify products were returned for the current credentials.");
  }

  const entitySourceProvenance = buildEntityProvenance({
    fetchedAt,
    storeDomain: access.storeDomain,
    shop,
    products,
    collections,
    pages,
    blogArticles,
    policies,
  });

  return {
    source: "live_shopify",
    fetchedAt,
    storeDomain: access.storeDomain,
    shop,
    products,
    collections,
    pages,
    blogArticles,
    policies,
    rawPayload: {
      core: coreData,
      content: contentData,
    },
    warnings,
    errors,
    entitySourceProvenance,
  };
}
