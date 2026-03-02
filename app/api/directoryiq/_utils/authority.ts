import type { PostType } from "@/lib/directoryiq/selectionEngine";
import crypto from "crypto";

export function normalizeSlot(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    throw new Error("Slot must be 1-4.");
  }
  return n;
}

export function normalizePostType(value: string): PostType {
  if (value === "comparison" || value === "best_of" || value === "contextual_guide" || value === "persona_intent") {
    return value;
  }
  return "contextual_guide";
}

export function buildSimpleHtmlDiff(beforeHtml: string, afterHtml: string): Array<{
  section: string;
  before: string;
  after: string;
}> {
  if (beforeHtml.trim() === afterHtml.trim()) {
    return [{ section: "Content", before: beforeHtml, after: afterHtml }];
  }

  return [
    {
      section: "Content",
      before: beforeHtml,
      after: afterHtml,
    },
  ];
}

export function makeVersionLabel(prefix: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `${prefix}-${stamp}`;
}

type ApprovalPayload = {
  userId: string;
  listingId?: string;
  slot?: number;
  versionId?: string;
  action: "listing_push" | "blog_publish" | "restore";
  exp: number;
};

function tokenSecret(): string {
  return process.env.DIRECTORYIQ_APPROVAL_SECRET || process.env.SERVER_ENCRYPTION_KEY || "directoryiq-approval";
}

export function issueApprovalToken(payload: Omit<ApprovalPayload, "exp">, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const fullPayload: ApprovalPayload = { ...payload, exp };
  const body = Buffer.from(JSON.stringify(fullPayload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyApprovalToken(
  token: string,
  expected: Omit<ApprovalPayload, "exp">
): { ok: true } | { ok: false; reason: string } {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "Malformed approval token." };
  const expectedSig = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url");
  if (sig !== expectedSig) return { ok: false, reason: "Invalid approval token signature." };

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ApprovalPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "Approval token expired." };
  }

  if (
    payload.userId !== expected.userId ||
    payload.action !== expected.action ||
    payload.listingId !== expected.listingId ||
    payload.slot !== expected.slot ||
    payload.versionId !== expected.versionId
  ) {
    return { ok: false, reason: "Approval token scope mismatch." };
  }

  return { ok: true };
}
