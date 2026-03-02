export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { getDirectoryIqSettings, upsertDirectoryIqSettings } from "@/app/api/directoryiq/_utils/selectionData";
import type { DirectoryIqVerticalId, RiskTier } from "@/lib/directoryiq/selectionEngine";

function normalizeVertical(value: unknown): DirectoryIqVerticalId | null {
  if (
    value === "home-services" ||
    value === "health-medical" ||
    value === "legal-financial" ||
    value === "hospitality-travel" ||
    value === "education" ||
    value === "general"
  ) {
    return value;
  }
  return null;
}

function normalizeRiskOverrides(value: unknown): Partial<Record<DirectoryIqVerticalId, RiskTier>> {
  if (!value || typeof value !== "object") return {};

  const out: Partial<Record<DirectoryIqVerticalId, RiskTier>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const vertical = normalizeVertical(key);
    if (!vertical) continue;
    if (raw === "low" || raw === "medium" || raw === "high") {
      out[vertical] = raw;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const settings = await getDirectoryIqSettings(userId);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown settings error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = resolveUserId(req);
    await ensureUser(userId);

    const body = (await req.json()) as {
      vertical_override?: string | null;
      risk_tier_overrides?: unknown;
      image_style_preference?: string;
    };

    await upsertDirectoryIqSettings(userId, {
      verticalOverride: normalizeVertical(body.vertical_override ?? null),
      riskTierOverrides: normalizeRiskOverrides(body.risk_tier_overrides),
      imageStylePreference: (body.image_style_preference ?? "editorial clean").trim() || "editorial clean",
    });

    const settings = await getDirectoryIqSettings(userId);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown settings save error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
