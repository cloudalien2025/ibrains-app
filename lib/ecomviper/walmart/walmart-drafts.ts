import "server-only";

import { appendActivityLog } from "@/lib/ecomviper/core/activity-log";
import { createDraftRecord, validateDraftPayload } from "@/lib/ecomviper/core/draft-workflow";
import {
  getLatestPersistedWalmartDraftForSku,
  getPersistedWalmartDraftById,
  listPersistedWalmartDrafts,
  savePersistedWalmartDraft,
} from "@/lib/ecomviper/walmart/walmart-draft-repository";
import type { WalmartDraftRecord, WalmartProductRecord } from "@/lib/ecomviper/walmart/walmart-types";

function normalizeSkuKey(value: string): string {
  return value.trim().toUpperCase();
}

export async function listWalmartDraftsForUser(userId: string): Promise<WalmartDraftRecord[]> {
  return listPersistedWalmartDrafts({ userId, includeDiscarded: false });
}

export async function getWalmartDraftByIdForUser(
  userId: string,
  draftId: string
): Promise<WalmartDraftRecord | null> {
  return getPersistedWalmartDraftById({ userId, draftId });
}

export async function upsertWalmartDraftForUser(input: {
  userId: string;
  sku: string;
  draftPayload: Record<string, unknown>;
  product: WalmartProductRecord;
}): Promise<WalmartDraftRecord> {
  const validation = validateDraftPayload(input.draftPayload);
  const now = new Date().toISOString();
  const existing = await getLatestPersistedWalmartDraftForSku({
    userId: input.userId,
    sku: input.sku,
    includeDiscarded: false,
  });

  if (existing) {
    const updated: WalmartDraftRecord = {
      ...existing,
      draftPayload: input.draftPayload,
      productTitle: input.product.title,
      validationResult: {
        valid: validation.valid,
        violations: validation.violations,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      },
      status: validation.valid ? "validated" : "draft",
      changeSummary: `${Object.keys(input.draftPayload).length} staged field(s)`,
      updatedAt: now,
      createdBy: input.userId,
    };

    await savePersistedWalmartDraft({
      userId: input.userId,
      draft: updated,
    });

    appendActivityLog({
      marketplace: "walmart",
      sku: input.product.sku,
      actionType: "draft_update",
      result: validation.valid ? "success" : "warning",
      message: "Draft updated.",
      afterPayload: updated,
    });

    return updated;
  }

  const created = createDraftRecord({
    sku: input.product.sku,
    title: input.product.title,
    productId: input.product.id,
    draftPayload: input.draftPayload,
    changeSummary: `${Object.keys(input.draftPayload).length} staged field(s)`,
    createdBy: input.userId,
    status: validation.valid ? "validated" : "draft",
    validationResult: {
      valid: validation.valid,
      violations: validation.violations,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
    },
  });

  await savePersistedWalmartDraft({
    userId: input.userId,
    draft: created,
  });

  appendActivityLog({
    marketplace: "walmart",
    sku: input.product.sku,
    actionType: "draft_create",
    result: validation.valid ? "success" : "warning",
    message: "Draft created.",
    afterPayload: created,
  });

  return created;
}

export async function validateWalmartDraftForUser(
  userId: string,
  draftId: string
): Promise<WalmartDraftRecord> {
  const draft = await getPersistedWalmartDraftById({ userId, draftId });
  if (!draft) {
    throw new Error("Draft not found");
  }

  const validation = validateDraftPayload(draft.draftPayload);
  const updated: WalmartDraftRecord = {
    ...draft,
    validationResult: {
      valid: validation.valid,
      violations: validation.violations,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
    },
    status: validation.valid ? "validated" : "failed",
    updatedAt: new Date().toISOString(),
  };

  await savePersistedWalmartDraft({
    userId,
    draft: updated,
  });

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_validate",
    result: validation.valid ? "success" : "warning",
    message: validation.valid ? "Draft validation passed." : "Draft validation failed.",
    afterPayload: updated,
  });

  return updated;
}

export async function submitWalmartDraftForUser(
  userId: string,
  draftId: string
): Promise<WalmartDraftRecord> {
  const draft = await getPersistedWalmartDraftById({ userId, draftId });
  if (!draft) {
    throw new Error("Draft not found");
  }

  const hasBlockingIssues =
    !draft.validationResult.valid ||
    (draft.validationResult.violations?.length ?? 0) > 0;
  const updated: WalmartDraftRecord = {
    ...draft,
    status: hasBlockingIssues ? "failed" : "submitted",
    publishStatus: hasBlockingIssues ? "failed" : "submitted",
    updatedAt: new Date().toISOString(),
  };

  await savePersistedWalmartDraft({
    userId,
    draft: updated,
  });

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_submit",
    result: hasBlockingIssues ? "error" : "warning",
    message: hasBlockingIssues
      ? "Draft submit blocked by validation/compliance issues."
      : "Production write disabled until preview/validation is complete.",
    afterPayload: hasBlockingIssues ? undefined : updated,
  });

  return updated;
}

export async function discardWalmartDraftForUser(
  userId: string,
  draftId: string
): Promise<WalmartDraftRecord> {
  const draft = await getPersistedWalmartDraftById({ userId, draftId });
  if (!draft) {
    throw new Error("Draft not found");
  }

  const updated: WalmartDraftRecord = {
    ...draft,
    status: "discarded",
    publishStatus: "failed",
    updatedAt: new Date().toISOString(),
  };

  await savePersistedWalmartDraft({
    userId,
    draft: updated,
  });

  appendActivityLog({
    marketplace: "walmart",
    sku: draft.sku,
    actionType: "draft_discard",
    result: "warning",
    message: "Draft discarded.",
    afterPayload: updated,
  });

  return updated;
}

export async function discardWalmartDraftsForSkuForUser(userId: string, sku: string): Promise<number> {
  const skuKey = normalizeSkuKey(sku);
  if (!skuKey) return 0;

  const allDrafts = await listPersistedWalmartDrafts({ userId, includeDiscarded: true });
  const toDiscard = allDrafts.filter(
    (draft) => normalizeSkuKey(draft.sku) === skuKey && draft.status !== "discarded"
  );

  if (toDiscard.length === 0) return 0;

  const updatedAt = new Date().toISOString();
  for (const draft of toDiscard) {
    const discardedDraft: WalmartDraftRecord = {
      ...draft,
      status: "discarded",
      publishStatus: "failed",
      updatedAt,
    };
    await savePersistedWalmartDraft({
      userId,
      draft: discardedDraft,
    });

    appendActivityLog({
      marketplace: "walmart",
      sku: draft.sku,
      actionType: "draft_discard",
      result: "warning",
      message: "Draft discarded due to local product removal.",
      afterPayload: discardedDraft,
    });
  }

  return toDiscard.length;
}
