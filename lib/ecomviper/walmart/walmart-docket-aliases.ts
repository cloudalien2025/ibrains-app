export const WALMART_DOCKET_SHORT_DESCRIPTION_ALIASES = [
  "siteDescription",
  "shelfDescription",
  "shortDescription",
  "short_description",
  "productDescription",
  "description",
  "raw.content.siteDescription",
  "raw.content.shelfDescription",
  "raw.product.siteDescription",
  "raw.product.shortDescription",
] as const;

export const WALMART_DOCKET_LONG_DESCRIPTION_ALIASES = [
  "fullDescription",
  "longDescription",
  "long_description",
  "productLongDescription",
  "detailedDescription",
  "raw.content.fullDescription",
  "raw.content.longDescription",
  "raw.product.fullDescription",
  "raw.product.longDescription",
] as const;

export const WALMART_DOCKET_BULLET_ALIASES = [
  "keyFeatures",
  "features",
  "highlights",
  "aboutThisItem",
  "bulletPoints",
  "keyFeature",
  "sellingPoints",
  "raw.content.keyFeatures",
  "raw.content.features",
  "raw.content.highlights",
  "raw.content.aboutThisItem",
  "raw.product.keyFeatures",
  "raw.product.features",
  "raw.product.highlights",
  "raw.product.aboutThisItem",
] as const;

export const WALMART_DOCKET_IMAGE_ALIASES = [
  "primaryImage",
  "mainImage",
  "imageUrl",
  "productImageUrl",
  "additionalImages",
  "alternateImages",
  "secondaryImages",
  "raw.content.images",
  "raw.product.images",
  "primaryImageUrl",
  "galleryImageUrls",
  "variantImageUrls",
  "additionalImageUrls",
] as const;

export const WALMART_DOCKET_TITLE_ALIASES = [
  "title",
  "productName",
  "name",
  "product_title",
  "raw.content.productName",
  "raw.product.title",
] as const;

export const WALMART_DOCKET_BRAND_ALIASES = [
  "brand",
  "brandName",
  "manufacturer",
  "manufacturerName",
] as const;

export const WALMART_DOCKET_PRICE_ALIASES = [
  "price",
  "price.amount",
  "currentPrice",
  "currentPrice.amount",
  "priceInfo.currentPrice",
  "priceInfo.currentPrice.amount",
  "offerPrice",
  "offerPrice.amount",
] as const;

export const WALMART_DOCKET_SALE_PRICE_ALIASES = [
  "salePrice",
  "sale_price",
  "specialPrice",
  "promoPrice",
  "promo_price",
] as const;

export const WALMART_DOCKET_INVENTORY_ALIASES = [
  "inventoryQuantity",
  "quantity",
  "inventory.quantity",
  "availability.quantity",
  "fulfillment.quantity",
  "availableToSellQty",
  "onHandQuantity",
] as const;

export const WALMART_DOCKET_STATUS_ALIASES = [
  "inventoryStatus",
  "availability",
  "availabilityStatus",
  "inventory.status",
] as const;

export const WALMART_DOCKET_ITEM_ID_ALIASES = [
  "publicWalmartProductId",
  "publicWalmartItemId",
  "itemId",
  "usItemId",
  "productId",
  "raw.itemId",
  "raw.usItemId",
  "raw.product.itemId",
] as const;

export const WALMART_DOCKET_PUBLIC_URL_ALIASES = [
  "publicWalmartUrl",
  "publicWalmartListingUrl",
  "itemPageUrl",
  "walmartItemPageUrl",
  "productPageUrl",
  "productUrl",
  "canonicalUrl",
  "url",
] as const;
