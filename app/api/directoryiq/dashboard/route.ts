export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { proxyDirectoryIqRequest } from "@/app/api/directoryiq/_utils/externalReadProxy";
import { ensureUser, resolveUserId } from "@/app/api/ecomviper/_utils/user";
import { query } from "@/app/api/ecomviper/_utils/db";
import { getAllListingsWithEvaluations, getDirectoryIqSettings } from "@/app/api/directoryiq/_utils/selectionData";
import { listBdSites } from "@/app/api/directoryiq/_utils/bdSites";
import { scheduleSnapshotRefresh } from "@/app/api/_utils/snapshots";

const DEFAULT_DIRECTORYIQ_API_BASE = "https://directoryiq-api.ibrains.ai";
const DASHBOARD_PATH = "/api/directoryiq/dashboard";

type DashboardListing = {
  listing_id: string;
  listing_name: string;
  score: number;
  authority_status: string;
  trust_status: string;
  last_optimized: string | null;
};

type LastRunRow = {
  finished_at: string | null;
};

function resolveDirectoryIqApiBase(): string {
  const raw = (
    process.env.DIRECTORYIQ_API_BASE ??
    process.env.NEXT_PUBLIC_DIRECTORYIQ_API_BASE ??
    DEFAULT_DIRECTORYIQ_API_BASE
  )
    .trim()
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("DIRECTORYIQ_API_BASE must use http or https");
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid DIRECTORYIQ_API_BASE: ${error.message}`
        : "Invalid DIRECTORYIQ_API_BASE"
    );
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function requestHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded && forwarded.trim()) return normalizeHost(forwarded);
  const hostHeader = req.headers.get("host");
  if (hostHeader && hostHeader.trim()) return normalizeHost(hostHeader);
  return normalizeHost(req.nextUrl.host);
}

function targetHost(): string {
  return normalizeHost(new URL(resolveDirectoryIqApiBase()).host);
}

async function loadDashboard(userId: string) {
  const [sites, listingEval, settings, latestRunRows] = await Promise.all([
    listBdSites(userId),
    getAllListingsWithEvaluations(userId),
    getDirectoryIqSettings(userId),
    query<LastRunRow>(
      `
      SELECT finished_at
      FROM directoryiq_ingest_runs
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 1
      `,
      [userId]
    ),
  ]);

  const listings: DashboardListing[] = listingEval.cards.map((card) => ({
    listing_id: card.listingId,
    listing_name: card.name,
    score: card.evaluation.totalScore,
    authority_status: card.authorityStatus.toLowerCase().replace(/\s+/g, "_"),
    trust_status: card.trustStatus.toLowerCase().replace(/\s+/g, "_"),
    last_optimized: card.lastOptimized,
  }));

  const connected = sites.some(
    (site) => site.enabled && site.secretPresent && site.baseUrl.trim().length > 0 && site.listingsDataId != null
  );

  return {
    connected,
    readiness: listingEval.readiness,
    pillars: listingEval.pillarAverages,
    listings,
    vertical_detected: listingEval.verticalDetected,
    vertical_override: settings.verticalOverride ?? null,
    last_analyzed_at: latestRunRows[0]?.finished_at ?? null,
    progress_messages: [
      "Evaluating selection signals...",
      "Scoring listing quality...",
      "Updating readiness overview...",
    ],
  };
}

export async function GET(req: NextRequest) {
  if (requestHost(req) === targetHost()) {
    try {
      const userId = resolveUserId(req);
      await ensureUser(userId);
      const payload = await loadDashboard(userId);
      return NextResponse.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown dashboard error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return proxyDirectoryIqRequest(req, DASHBOARD_PATH, "GET");
}

export async function POST(req: NextRequest) {
  if (requestHost(req) === targetHost()) {
    try {
      const userId = resolveUserId(req);
      await ensureUser(userId);
      await scheduleSnapshotRefresh({ userId, brainId: "directoryiq", runIngest: true });
      const payload = await loadDashboard(userId);
      return NextResponse.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown dashboard refresh error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return proxyDirectoryIqRequest(req, DASHBOARD_PATH, "POST");
}
