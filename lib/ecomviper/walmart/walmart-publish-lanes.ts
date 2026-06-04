export type WalmartPublishStatusErrorType =
  | "DATA_ERROR"
  | "SYSTEM_ERROR"
  | "TIMEOUT_ERROR"
  | "UNKNOWN_ERROR";

export interface WalmartPublishLaneDiffRow {
  field: string;
  before: string | number | string[] | null;
  after: string | number | string[] | null;
}

export interface WalmartPublishLanePreview {
  lane: "content_item_lane" | "price_lane" | "inventory_lane" | "status_lane";
  laneLabel: string;
  changed: boolean;
  diff: WalmartPublishLaneDiffRow[];
  payload: Record<string, unknown>;
}

export interface WalmartPublishPreviewResult {
  status: "preview_ready" | "no_changes" | "preview_only_no_publish_route";
  lanes: {
    content_item_lane: WalmartPublishLanePreview;
    price_lane: WalmartPublishLanePreview;
    inventory_lane: WalmartPublishLanePreview;
    status_lane: WalmartPublishLanePreview;
  };
  validation: {
    errors: string[];
    warnings: string[];
  };
}

interface BuildPreviewInput {
  sku: string;
  current: {
    title: string;
    shortDescription: string;
    longDescription: string;
    bulletPoints: string[];
    brand: string;
    imageUrl: string;
    galleryImageUrls: string[];
    searchBrowseAttributes: Record<string, string>;
    attributes: Record<string, string>;
    price: number | null;
    inventoryQuantity: number | null;
    publicWalmartUrl?: string | null;
    publicWalmartProductId?: string | null;
    gtin?: string | null;
    upc?: string | null;
  };
  draft: {
    title: string;
    shortDescription: string;
    longDescription: string;
    bulletPoints: string[];
    brand: string;
    imageUrl: string;
    galleryImageUrls: string[];
    searchBrowseAttributes: Record<string, string>;
    attributes: Record<string, string>;
    price: number | null;
    inventoryQuantity: number | null;
    publicWalmartUrl?: string | null;
    publicWalmartProductId?: string | null;
  };
  complianceViolations?: string[];
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asSortedRecordSignature(record: Record<string, string>): string {
  return Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${key}:${record[key]}`)
    .join("|");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function pushDiffIfChanged(
  diff: WalmartPublishLaneDiffRow[],
  field: string,
  before: string | number | string[] | null,
  after: string | number | string[] | null
) {
  const beforeSignature = Array.isArray(before) ? before.join("|") : String(before ?? "");
  const afterSignature = Array.isArray(after) ? after.join("|") : String(after ?? "");
  if (beforeSignature === afterSignature) return;
  diff.push({ field, before, after });
}

export function buildWalmartPublishLanePreview(input: BuildPreviewInput): WalmartPublishPreviewResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const currentPublicItemId = cleanText(input.current.publicWalmartProductId);
  const draftPublicItemId = cleanText(input.draft.publicWalmartProductId);
  const effectivePublicItemId = draftPublicItemId || currentPublicItemId;
  const effectivePublicUrl = cleanText(input.draft.publicWalmartUrl) || cleanText(input.current.publicWalmartUrl);

  if (!cleanText(input.draft.title)) {
    errors.push("Product title is required before publish.");
  }

  const lookupOnlyIds = new Set([cleanText(input.current.gtin), cleanText(input.current.upc)].filter(Boolean));
  if (effectivePublicItemId && lookupOnlyIds.has(effectivePublicItemId)) {
    errors.push("GTIN/UPC are lookup identifiers only and cannot be used as Walmart item IDs.");
  }

  if (!effectivePublicItemId && !effectivePublicUrl) {
    errors.push("Publish requires a confirmed Walmart item ID or canonical public listing URL.");
  }

  const hasRiskyClaims = (input.complianceViolations ?? []).some((entry) =>
    /(disease|treat|cure|prevent|malformed fda disclaimer|missing the canonical fda supplement disclaimer)/i.test(
      entry
    )
  );
  if (hasRiskyClaims) {
    errors.push("Unsafe supplement claims/compliance violations must be resolved before content publish.");
  }

  if (!cleanText(input.draft.imageUrl) && input.draft.galleryImageUrls.length === 0) {
    warnings.push("Media readiness warning: primary image or gallery image is missing.");
  }

  const contentDiff: WalmartPublishLaneDiffRow[] = [];
  pushDiffIfChanged(contentDiff, "title", cleanText(input.current.title), cleanText(input.draft.title));
  pushDiffIfChanged(
    contentDiff,
    "shortDescription",
    cleanText(input.current.shortDescription),
    cleanText(input.draft.shortDescription)
  );
  pushDiffIfChanged(
    contentDiff,
    "longDescription",
    cleanText(input.current.longDescription),
    cleanText(input.draft.longDescription)
  );
  pushDiffIfChanged(contentDiff, "bulletPoints", unique(input.current.bulletPoints), unique(input.draft.bulletPoints));
  pushDiffIfChanged(contentDiff, "brand", cleanText(input.current.brand), cleanText(input.draft.brand));
  pushDiffIfChanged(contentDiff, "primaryImageUrl", cleanText(input.current.imageUrl), cleanText(input.draft.imageUrl));
  pushDiffIfChanged(
    contentDiff,
    "galleryImageUrls",
    unique(input.current.galleryImageUrls),
    unique(input.draft.galleryImageUrls)
  );
  if (
    asSortedRecordSignature(input.current.searchBrowseAttributes) !==
    asSortedRecordSignature(input.draft.searchBrowseAttributes)
  ) {
    contentDiff.push({
      field: "searchBrowseAttributes",
      before: Object.keys(input.current.searchBrowseAttributes).length,
      after: Object.keys(input.draft.searchBrowseAttributes).length,
    });
  }
  if (asSortedRecordSignature(input.current.attributes) !== asSortedRecordSignature(input.draft.attributes)) {
    contentDiff.push({
      field: "attributes",
      before: Object.keys(input.current.attributes).length,
      after: Object.keys(input.draft.attributes).length,
    });
  }

  const priceDiff: WalmartPublishLaneDiffRow[] = [];
  pushDiffIfChanged(priceDiff, "price", cleanNumber(input.current.price), cleanNumber(input.draft.price));

  const inventoryDiff: WalmartPublishLaneDiffRow[] = [];
  pushDiffIfChanged(
    inventoryDiff,
    "quantity",
    cleanNumber(input.current.inventoryQuantity),
    cleanNumber(input.draft.inventoryQuantity)
  );

  const contentLane: WalmartPublishLanePreview = {
    lane: "content_item_lane",
    laneLabel: "Content/media/attributes",
    changed: contentDiff.length > 0,
    diff: contentDiff,
    payload: {
      feedType: "MP_MAINTENANCE",
      sku: input.sku,
      itemId: effectivePublicItemId || null,
      publicWalmartUrl: effectivePublicUrl || null,
      partialUpdate: true,
      updates: Object.fromEntries(contentDiff.map((entry) => [entry.field, entry.after])),
    },
  };

  const priceLane: WalmartPublishLanePreview = {
    lane: "price_lane",
    laneLabel: "Price",
    changed: priceDiff.length > 0,
    diff: priceDiff,
    payload: {
      singleSkuUpdate: {
        endpoint: "/v3/price",
        sku: input.sku,
        price: cleanNumber(input.draft.price),
      },
      bulkPreview: {
        feedType: "PRICE",
        rows: priceDiff.length > 0 ? 1 : 0,
      },
    },
  };

  const inventoryLane: WalmartPublishLanePreview = {
    lane: "inventory_lane",
    laneLabel: "Inventory",
    changed: inventoryDiff.length > 0,
    diff: inventoryDiff,
    payload: {
      singleSkuUpdate: {
        endpoint: "/v3/inventory",
        sku: input.sku,
        quantity: cleanNumber(input.draft.inventoryQuantity),
        shipNode: null,
      },
      bulkPreview: {
        feedType: "INVENTORY",
        rows: inventoryDiff.length > 0 ? 1 : 0,
      },
    },
  };

  const statusLane: WalmartPublishLanePreview = {
    lane: "status_lane",
    laneLabel: "Status tracking",
    changed: contentLane.changed || priceLane.changed || inventoryLane.changed,
    diff: [],
    payload: {
      submitMode: "preview_only",
      feedId: null,
      itemLevelStatus: [],
      supportedErrorTypes: ["DATA_ERROR", "SYSTEM_ERROR", "TIMEOUT_ERROR", "UNKNOWN_ERROR"] as WalmartPublishStatusErrorType[],
      confirmationRequired: true,
      submitted: false,
    },
  };

  if (!contentLane.changed && !priceLane.changed && !inventoryLane.changed) {
    warnings.push("No publishable changes detected; preview is no-op.");
  }

  return {
    status:
      !contentLane.changed && !priceLane.changed && !inventoryLane.changed
        ? "no_changes"
        : "preview_only_no_publish_route",
    lanes: {
      content_item_lane: contentLane,
      price_lane: priceLane,
      inventory_lane: inventoryLane,
      status_lane: statusLane,
    },
    validation: {
      errors: unique(errors),
      warnings: unique(warnings),
    },
  };
}
