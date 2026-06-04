import {
  summarizeDraftChanges,
  type ShopifyCurrentListingDocket,
  type ShopifyDraftChangeRow,
  type ShopifyEditableDraftDocket,
} from "@/lib/ecomviper/shopify/shopify-product-docket";

export const SHOPIFY_STEP3_PUBLISH_OUTCOME_CODES = [
  "confirmation_required",
  "publish_not_enabled",
] as const;

export type ShopifyStep3PublishOutcomeCode = (typeof SHOPIFY_STEP3_PUBLISH_OUTCOME_CODES)[number];

export const SHOPIFY_STEP3_AUDIT_EVENT_CODES = [
  "draft_saved_local",
  "update_prepared_local",
  "publish_blocked_confirmation_required",
  "publish_intent_confirmed_dry_run",
  "publish_blocked_not_enabled",
] as const;

export type ShopifyStep3AuditEventCode = (typeof SHOPIFY_STEP3_AUDIT_EVENT_CODES)[number];
export type ShopifyStep3AuditEventLevel = "info" | "warning";

export interface ShopifyStep3AuditEvent {
  code: ShopifyStep3AuditEventCode;
  message: string;
  level: ShopifyStep3AuditEventLevel;
  occurredAt: string;
}

export interface ShopifyStep3DiffPreview {
  generatedAt: string;
  totalChanges: number;
  apiPushableChanges: number;
  recommendationOnlyChanges: number;
  changes: ShopifyDraftChangeRow[];
}

export interface ShopifyStep3PublishIntent {
  productId: string;
  productHandle: string;
  requestedAt: string;
  confirmationAccepted: boolean;
  diffPreview: ShopifyStep3DiffPreview;
}

export interface ShopifyStep3PublishDryRunResult {
  status: "blocked";
  code: ShopifyStep3PublishOutcomeCode;
  message: string;
  recoveryActions: string[];
  auditEvents: ShopifyStep3AuditEvent[];
}

function asIso(value?: string): string {
  return value?.trim() || new Date().toISOString();
}

function fieldOrder(field: string): number {
  if (field === "Title") return 10;
  if (field === "Description") return 20;
  if (field === "SEO title") return 30;
  if (field === "SEO description") return 40;
  if (field === "Tags") return 50;
  if (field === "Product type") return 60;
  if (field.startsWith("Image alt text (")) return 70;
  if (field === "Collection suggestions") return 80;
  return 99;
}

function compareDraftChanges(left: ShopifyDraftChangeRow, right: ShopifyDraftChangeRow): number {
  const fieldDiff = fieldOrder(left.field) - fieldOrder(right.field);
  if (fieldDiff !== 0) return fieldDiff;

  const fieldNameDiff = left.field.localeCompare(right.field);
  if (fieldNameDiff !== 0) return fieldNameDiff;

  const beforeDiff = left.before.localeCompare(right.before);
  if (beforeDiff !== 0) return beforeDiff;

  const afterDiff = left.after.localeCompare(right.after);
  if (afterDiff !== 0) return afterDiff;

  if (left.apiPushable === right.apiPushable) return 0;
  return left.apiPushable ? -1 : 1;
}

export function buildShopifyStep3AuditEvent(
  code: ShopifyStep3AuditEventCode,
  message: string,
  options?: { level?: ShopifyStep3AuditEventLevel; occurredAt?: string }
): ShopifyStep3AuditEvent {
  return {
    code,
    message,
    level: options?.level ?? "info",
    occurredAt: asIso(options?.occurredAt),
  };
}

export function buildShopifyStep3DiffPreview(
  current: ShopifyCurrentListingDocket,
  draft: ShopifyEditableDraftDocket,
  options?: { generatedAt?: string }
): ShopifyStep3DiffPreview {
  const changes = summarizeDraftChanges(current, draft).sort(compareDraftChanges);
  const apiPushableChanges = changes.filter((change) => change.apiPushable).length;

  return {
    generatedAt: asIso(options?.generatedAt),
    totalChanges: changes.length,
    apiPushableChanges,
    recommendationOnlyChanges: changes.length - apiPushableChanges,
    changes,
  };
}

export function buildShopifyStep3PublishIntent(input: {
  current: ShopifyCurrentListingDocket;
  diffPreview: ShopifyStep3DiffPreview;
  confirmationAccepted: boolean;
  requestedAt?: string;
}): ShopifyStep3PublishIntent {
  return {
    productId: input.current.productId,
    productHandle: input.current.handle,
    requestedAt: asIso(input.requestedAt),
    confirmationAccepted: input.confirmationAccepted,
    diffPreview: input.diffPreview,
  };
}

export function evaluateShopifyStep3PublishDryRun(
  intent: ShopifyStep3PublishIntent
): ShopifyStep3PublishDryRunResult {
  if (!intent.confirmationAccepted) {
    return {
      status: "blocked",
      code: "confirmation_required",
      message: "Publish confirmation is required before dry-run publish review.",
      recoveryActions: [
        "Review the staged diff preview and verify intended field updates.",
        "Check the confirmation gate and retry the dry-run request.",
      ],
      auditEvents: [
        buildShopifyStep3AuditEvent(
          "publish_blocked_confirmation_required",
          "Publish request blocked because confirmation gate was not accepted.",
          { level: "warning", occurredAt: intent.requestedAt }
        ),
      ],
    };
  }

  return {
    status: "blocked",
    code: "publish_not_enabled",
    message: "Publish dry-run completed. Live Shopify publish remains disabled in Sprint 004.",
    recoveryActions: [
      "Use Save draft to keep local changes and preserve current draft state.",
      "Use Prepare update and route the change through the approved manual publish workflow.",
    ],
    auditEvents: [
      buildShopifyStep3AuditEvent(
        "publish_intent_confirmed_dry_run",
        `Publish intent reviewed in dry-run for ${intent.diffPreview.totalChanges} staged changes.`,
        { occurredAt: intent.requestedAt }
      ),
      buildShopifyStep3AuditEvent(
        "publish_blocked_not_enabled",
        "Live publish execution is intentionally blocked in Sprint 004.",
        { level: "warning", occurredAt: intent.requestedAt }
      ),
    ],
  };
}
