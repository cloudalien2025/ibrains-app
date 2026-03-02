const APPROVAL_TOKEN_SECRET = process.env.DIRECTORYIQ_APPROVAL_TOKEN_SECRET ?? "directoryiq-dev-secret";

type ApprovalAction = "blog_publish" | "listing_push";

type ApprovalPayload = {
  userId: string;
  listingId: string;
  action: ApprovalAction;
  slot?: number;
};

export function normalizeSlot(slot: string): number {
  const parsed = Number.parseInt(slot, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function normalizePostType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (!normalized) return "insight";
  return normalized;
}

export function makeVersionLabel(prefix: string): string {
  const normalized = prefix.trim() || "VERSION";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
  return `${normalized}-${stamp}`;
}

export function issueApprovalToken(payload: ApprovalPayload): string {
  const body = JSON.stringify({ ...payload, secret: APPROVAL_TOKEN_SECRET });
  return Buffer.from(body, "utf8").toString("base64url");
}

export function verifyApprovalToken(
  token: string,
  expected: ApprovalPayload
): { ok: boolean; reason: string } {
  if (!token) return { ok: false, reason: "Missing approval token." };

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as ApprovalPayload & { secret?: string };

    if (parsed.secret !== APPROVAL_TOKEN_SECRET) {
      return { ok: false, reason: "Token signature mismatch." };
    }
    if (parsed.userId !== expected.userId) {
      return { ok: false, reason: "Token user mismatch." };
    }
    if (parsed.listingId !== expected.listingId) {
      return { ok: false, reason: "Token listing mismatch." };
    }
    if (parsed.action !== expected.action) {
      return { ok: false, reason: "Token action mismatch." };
    }
    if ((expected.slot ?? null) !== (parsed.slot ?? null)) {
      return { ok: false, reason: "Token slot mismatch." };
    }

    return { ok: true, reason: "ok" };
  } catch {
    return { ok: false, reason: "Malformed approval token." };
  }
}
