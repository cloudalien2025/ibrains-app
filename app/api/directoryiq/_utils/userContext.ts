import type { NextRequest } from "next/server";

const DEFAULT_DIRECTORYIQ_USER_ID = "00000000-0000-4000-8000-000000000001";

function normalizeUuid(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    trimmed
  );
  return valid ? trimmed : null;
}

function canonicalDirectoryIqUserId(): string {
  const configured = normalizeUuid(process.env.DIRECTORYIQ_CANONICAL_USER_ID ?? null);
  return configured ?? DEFAULT_DIRECTORYIQ_USER_ID;
}

export function resolveDirectoryIqUserId(req?: NextRequest): string {
  if (!req) return canonicalDirectoryIqUserId();

  const fromHeader = normalizeUuid(req.headers.get("x-user-id"));
  if (fromHeader) return fromHeader;

  const fromSearch = normalizeUuid(req.nextUrl.searchParams.get("user_id"));
  if (fromSearch) return fromSearch;

  return canonicalDirectoryIqUserId();
}

