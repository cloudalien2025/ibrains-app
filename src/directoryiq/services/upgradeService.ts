import crypto from "crypto";
import { buildDiffRows } from "@/src/directoryiq/domain/diff";
import { DiffRow, UpgradeDraft } from "@/src/directoryiq/domain/types";
import { requestBd } from "@/src/directoryiq/adapters/bd/bdClient";
import { runUpgradePrompt } from "@/src/directoryiq/adapters/openai/promptRunner";
import { buildListingUpgradePromptV1 } from "@/src/directoryiq/prompts/listing_upgrade_v1";
import { writeAuditEvent } from "@/src/directoryiq/repositories/auditRepo";
import { createDraft, getDraft, hashText, markPreviewed, markPushed } from "@/src/directoryiq/repositories/upgradeDraftRepo";
import { persistListingTruePostMapping } from "@/src/directoryiq/repositories/listingIdentityRepo";
import { hasBlockedPlaceholders } from "@/src/directoryiq/validators/outputGuards";
import { getBdConnection, getIntegrationStatus, getOpenAiKey } from "@/src/directoryiq/services/integrationsService";
import { getListingFacts } from "@/src/directoryiq/services/listingService";
import { DirectoryIqServiceError } from "@/src/directoryiq/services/errors";
import { issueApprovalToken, verifyApprovalToken } from "@/src/directoryiq/services/tokenService";
import { resolveTruePostIdForListing } from "@/app/api/directoryiq/_utils/integrations";

export type GenerateUpgradeInput = {
  userId: string;
  listingId: string;
  mode?: "default" | "strict";
};

export type GenerateUpgradeResult = {
  reqId: string;
  draft: UpgradeDraft;
};

export type PreviewUpgradeResult = {
  reqId: string;
  draftId: string;
  original: string;
  proposed: string;
  diff: DiffRow[];
  approvalToken: string;
};

export type PushUpgradeResult = {
  reqId: string;
  ok: boolean;
  draftId: string;
  bdRef: string | null;
};

function reqId(): string {
  return crypto.randomUUID();
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function deterministicMockUpgrade(title: string, originalText: string): string {
  const seed = originalText.trim() || `${title} serves local customers with focused, high-quality service.`;
  return `${seed}\n\nContact the business directly to confirm availability, pricing, and next-step scheduling.`;
}

function toUpgradeDraft(record: {
  id: string;
  listingId: string;
  originalHash: string;
  originalText: string;
  proposedText: string;
  status: "draft" | "previewed" | "pushed";
  createdAt: string;
  previewedAt: string | null;
  pushedAt: string | null;
  bdRef: string | null;
}): UpgradeDraft {
  return {
    id: record.id,
    listingId: record.listingId,
    originalHash: record.originalHash,
    originalText: record.originalText,
    proposedText: record.proposedText,
    status: record.status,
    createdAt: record.createdAt,
    previewedAt: record.previewedAt,
    pushedAt: record.pushedAt,
    bdRef: record.bdRef,
  };
}

export async function generateUpgrade(input: GenerateUpgradeInput): Promise<GenerateUpgradeResult> {
  const requestId = reqId();
  const listing = await getListingFacts(input.userId, input.listingId);
  if (!listing) {
    throw new DirectoryIqServiceError({
      status: 404,
      code: "NOT_FOUND",
      reqId: requestId,
      message: "Listing not found.",
    });
  }

  const integrations = await getIntegrationStatus(input.userId);
  const useMockOpenAi = process.env.E2E_MOCK_OPENAI === "1";
  if (!useMockOpenAi && !integrations.openaiConfigured) {
    throw new DirectoryIqServiceError({
      status: 400,
      code: "OPENAI_NOT_CONFIGURED",
      reqId: requestId,
      message: "OpenAI not configured.",
      details: "Configure OpenAI under DirectoryIQ integrations.",
    });
  }

  const originalText = listing.description || "";
  let proposedText: string;
  if (useMockOpenAi) {
    proposedText = deterministicMockUpgrade(listing.title, originalText);
  } else {
    const apiKey = await getOpenAiKey(input.userId);
    if (!apiKey) {
      throw new DirectoryIqServiceError({
        status: 400,
        code: "OPENAI_NOT_CONFIGURED",
        reqId: requestId,
        message: "OpenAI not configured.",
      });
    }

    const prompt = buildListingUpgradePromptV1({
      listingName: listing.title,
      listingUrl: listing.url,
      originalDescription: originalText,
      allowedFacts: listing.allowedFacts,
      targets: ["Improve structure clarity", "Increase trust cues", "Add stronger next-step CTA"],
    });

    proposedText = await runUpgradePrompt(apiKey, prompt);
    if (hasBlockedPlaceholders(proposedText)) {
      proposedText = await runUpgradePrompt(apiKey, `${prompt}\n\nRegeneration rule: no placeholders, no bracket tokens.`);
    }

    if (hasBlockedPlaceholders(proposedText)) {
      throw new DirectoryIqServiceError({
        status: 502,
        code: "OPENAI_OUTPUT_INVALID",
        reqId: requestId,
        message: "Generated output failed quality checks.",
      });
    }
  }

  const row = await createDraft(
    listing.listingId,
    hashText(originalText),
    proposedText,
    input.userId,
    originalText
  );

  await writeAuditEvent({
    reqId: requestId,
    userId: input.userId,
    listingId: input.listingId,
    action: "upgrade.generate",
    status: "ok",
  });

  return {
    reqId: requestId,
    draft: toUpgradeDraft(row),
  };
}

export async function previewUpgrade(userId: string, listingId: string, draftId: string): Promise<PreviewUpgradeResult> {
  const requestId = reqId();
  const draft = await getDraft(draftId);
  if (!draft || draft.listingId !== listingId || draft.userId !== userId) {
    throw new DirectoryIqServiceError({
      status: 404,
      code: "NOT_FOUND",
      reqId: requestId,
      message: "Upgrade draft not found.",
    });
  }

  await markPreviewed(draftId);

  const approvalToken = issueApprovalToken({
    userId,
    listingId,
    draftId,
    action: "listing_push",
  });

  return {
    reqId: requestId,
    draftId,
    original: draft.originalText,
    proposed: draft.proposedText,
    diff: buildDiffRows(draft.originalText, draft.proposedText),
    approvalToken,
  };
}

export async function pushUpgrade(
  userId: string,
  listingId: string,
  draftId: string,
  approved: boolean,
  approvalToken: string
): Promise<PushUpgradeResult> {
  const requestId = reqId();
  if (!approved) {
    throw new DirectoryIqServiceError({
      status: 400,
      code: "APPROVAL_REQUIRED",
      reqId: requestId,
      message: "Push requires explicit approved=true.",
    });
  }

  const draft = await getDraft(draftId);
  if (!draft || draft.listingId !== listingId || draft.userId !== userId) {
    throw new DirectoryIqServiceError({
      status: 404,
      code: "NOT_FOUND",
      reqId: requestId,
      message: "Upgrade draft not found.",
    });
  }

  if (draft.status === "draft") {
    throw new DirectoryIqServiceError({
      status: 400,
      code: "PREVIEW_REQUIRED",
      reqId: requestId,
      message: "Preview changes before pushing to BD.",
    });
  }

  const tokenCheck = verifyApprovalToken(approvalToken, {
    userId,
    listingId,
    draftId,
    action: "listing_push",
  });

  if (!tokenCheck.ok) {
    throw new DirectoryIqServiceError({
      status: 400,
      code: "TOKEN_INVALID",
      reqId: requestId,
      message: tokenCheck.reason,
    });
  }

  let bdRef: string | null = null;
  if (process.env.E2E_MOCK_BD === "1") {
    bdRef = "mock-bd-update-ref";
  } else {
    const listing = await getListingFacts(userId, listingId);
    if (!listing) {
      throw new DirectoryIqServiceError({
        status: 404,
        code: "NOT_FOUND",
        reqId: requestId,
        message: "Listing not found.",
      });
    }

    const siteId = listingId.includes(":") ? listingId.split(":")[0] : null;
    const bd = await getBdConnection(userId, siteId);
    if (!bd) {
      throw new DirectoryIqServiceError({
        status: 400,
        code: "BD_NOT_CONFIGURED",
        reqId: requestId,
        message: "Brilliant Directories API not configured.",
      });
    }

    const persistedTruePostId = stringOrEmpty(listing.raw.true_post_id);
    const listingSlug =
      stringOrEmpty(listing.raw.listing_slug) ||
      stringOrEmpty(listing.raw.group_filename) ||
      stringOrEmpty(listing.url);
    const listingTitle = stringOrEmpty(listing.raw.group_name) || stringOrEmpty(listing.title);
    const usedPersistedMapping = Boolean(persistedTruePostId);
    const resolvedMapping = usedPersistedMapping
      ? { truePostId: persistedTruePostId, mappingKey: "slug" as const }
      : await resolveTruePostIdForListing({
          baseUrl: bd.baseUrl,
          apiKey: bd.apiKey,
          dataPostsSearchPath: bd.dataPostsSearchPath,
          listingsDataId: bd.listingsDataId,
          listingId,
          listingSlug,
          listingTitle,
        });
    const truePostId = resolvedMapping.truePostId ?? "";

    if (!truePostId) {
      throw new DirectoryIqServiceError({
        status: 422,
        code: "BD_MAPPING_MISSING",
        reqId: requestId,
        message: "Unable to resolve BD listing mapping for push.",
      });
    }

    if (!usedPersistedMapping && resolvedMapping.mappingKey !== "unresolved") {
      await persistListingTruePostMapping({
        userId,
        listingId,
        truePostId,
        mappingKey: resolvedMapping.mappingKey,
      });
    }

    const response = await requestBd({
      baseUrl: bd.baseUrl,
      path: bd.updatePath,
      apiKey: bd.apiKey,
      method: "PUT",
      form: {
        post_id: truePostId,
        short_description: draft.proposedText,
        group_desc: draft.proposedText,
      },
    });

    if (!response.ok) {
      throw new DirectoryIqServiceError({
        status: 502,
        code: "BD_PUSH_FAILED",
        reqId: requestId,
        message: "Brilliant Directories push failed.",
        details: JSON.stringify(response.json ?? {}),
      });
    }

    bdRef = truePostId;
  }

  await markPushed(draftId, bdRef ?? undefined);

  await writeAuditEvent({
    reqId: requestId,
    userId,
    listingId,
    action: "upgrade.push",
    status: "ok",
    details: bdRef ?? undefined,
  });

  return {
    reqId: requestId,
    ok: true,
    draftId,
    bdRef,
  };
}
