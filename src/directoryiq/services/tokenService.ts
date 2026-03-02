type ApprovalTokenPayload = {
  userId: string;
  listingId: string;
  draftId: string;
  action: "listing_push";
};

const TOKEN_SECRET = process.env.DIRECTORYIQ_APPROVAL_TOKEN_SECRET ?? "directoryiq-dev-secret";

export function issueApprovalToken(payload: ApprovalTokenPayload): string {
  const withSecret = { ...payload, secret: TOKEN_SECRET };
  return Buffer.from(JSON.stringify(withSecret), "utf8").toString("base64url");
}

export function verifyApprovalToken(token: string, expected: ApprovalTokenPayload): { ok: boolean; reason: string } {
  if (!token) return { ok: false, reason: "Missing approval token." };

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as ApprovalTokenPayload & { secret?: string };

    if (payload.secret !== TOKEN_SECRET) return { ok: false, reason: "Invalid token signature." };
    if (payload.userId !== expected.userId) return { ok: false, reason: "Token user mismatch." };
    if (payload.listingId !== expected.listingId) return { ok: false, reason: "Token listing mismatch." };
    if (payload.draftId !== expected.draftId) return { ok: false, reason: "Token draft mismatch." };
    if (payload.action !== expected.action) return { ok: false, reason: "Token action mismatch." };

    return { ok: true, reason: "ok" };
  } catch {
    return { ok: false, reason: "Malformed approval token." };
  }
}
