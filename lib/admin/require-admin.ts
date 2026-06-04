import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

export interface RequiredAdminSession {
  userId: string;
  email: string;
}

const DEFAULT_ADMIN_REDIRECT_PATH = "/admin";

function toLowerTrimmed(value: string): string {
  return value.trim().toLowerCase();
}

export function parseAdminEmailAllowlist(raw: string | undefined): Set<string> {
  if (!raw || !raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => toLowerTrimmed(entry))
      .filter(Boolean)
  );
}

function valueAsRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readClaimString(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSessionEmail(sessionClaims: unknown): string | null {
  const claims = valueAsRecord(sessionClaims);
  const directEmail =
    readClaimString(claims, "email") ||
    readClaimString(claims, "email_address") ||
    readClaimString(claims, "primary_email_address");
  if (directEmail) return directEmail;

  const metadata = valueAsRecord(claims.metadata);
  return readClaimString(metadata, "email") || null;
}

export function isAllowlistedAdminEmail(email: string | null, allowlistRaw = process.env.ADMIN_EMAIL_ALLOWLIST): boolean {
  if (!email) return false;
  const allowlist = parseAdminEmailAllowlist(allowlistRaw);
  if (allowlist.size === 0) return false;
  return allowlist.has(toLowerTrimmed(email));
}

export async function requireAdmin(options?: {
  redirectPath?: string;
  allowlistRaw?: string;
}): Promise<RequiredAdminSession> {
  if (process.env.E2E_MOCK_GRAPH === "1") {
    return {
      userId: "e2e-admin",
      email: "e2e-admin@ibrains.local",
    };
  }

  const redirectPath = options?.redirectPath || DEFAULT_ADMIN_REDIRECT_PATH;
  const authState = await auth().catch(() => ({ userId: null, sessionClaims: null }));
  const userId = typeof authState.userId === "string" && authState.userId.trim() ? authState.userId : null;
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`);
  }

  const email = resolveSessionEmail((authState as { sessionClaims?: unknown }).sessionClaims);
  if (!isAllowlistedAdminEmail(email, options?.allowlistRaw)) {
    notFound();
  }

  return {
    userId,
    email: email as string,
  };
}
