import { DiffRow, UpgradeDraft } from "@/src/directoryiq/domain/types";

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

export async function generateUpgrade(input: GenerateUpgradeInput): Promise<GenerateUpgradeResult> {
  const now = new Date().toISOString();
  const draft: UpgradeDraft = {
    id: `draft-${input.listingId}`,
    listingId: input.listingId,
    originalText: "",
    proposedText: "",
    status: "draft",
    originalHash: "",
    createdAt: now,
    previewedAt: null,
    pushedAt: null,
    bdRef: null,
  };
  return {
    reqId: `req-${Date.now()}`,
    draft,
  };
}

export async function previewUpgrade(_userId: string, _listingId: string, draftId: string): Promise<PreviewUpgradeResult> {
  return {
    reqId: `req-${Date.now()}`,
    draftId,
    original: "",
    proposed: "",
    diff: [],
    approvalToken: "",
  };
}

export async function pushUpgrade(_userId: string, _listingId: string, draftId: string, _approved: boolean): Promise<PushUpgradeResult> {
  return {
    reqId: `req-${Date.now()}`,
    ok: true,
    draftId,
    bdRef: null,
  };
}
