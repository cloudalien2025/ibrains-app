export type UpgradeDraftRecord = {
  id: string;
  listingId: string;
  originalHash: string;
  originalText: string;
  proposedText: string;
  status: "draft" | "previewed" | "pushed";
  bdRef: string | null;
  createdAt: string;
  previewedAt: string | null;
  pushedAt: string | null;
};

export type UpgradeDraftRepo = {
  createDraft: (listingId: string, originalHash: string, proposedText: string, createdBy?: string, originalText?: string) => Promise<UpgradeDraftRecord>;
  getDraft: (draftId: string) => Promise<UpgradeDraftRecord | null>;
  markPreviewed: (draftId: string) => Promise<void>;
  markPushed: (draftId: string, bdRef?: string) => Promise<void>;
};

const memory = new Map<string, UpgradeDraftRecord>();

export function createUpgradeDraftRepo(): UpgradeDraftRepo {
  return {
    async createDraft(listingId, originalHash, proposedText, _createdBy, originalText = "") {
      const id = `draft-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const row: UpgradeDraftRecord = {
        id,
        listingId,
        originalHash,
        originalText,
        proposedText,
        status: "draft",
        bdRef: null,
        createdAt: new Date().toISOString(),
        previewedAt: null,
        pushedAt: null,
      };
      memory.set(id, row);
      return row;
    },
    async getDraft(draftId) {
      return memory.get(draftId) ?? null;
    },
    async markPreviewed(draftId) {
      const row = memory.get(draftId);
      if (!row) return;
      row.status = "previewed";
      row.previewedAt = new Date().toISOString();
      memory.set(draftId, row);
    },
    async markPushed(draftId, bdRef) {
      const row = memory.get(draftId);
      if (!row) return;
      row.status = "pushed";
      row.bdRef = bdRef ?? null;
      row.pushedAt = new Date().toISOString();
      memory.set(draftId, row);
    },
  };
}
