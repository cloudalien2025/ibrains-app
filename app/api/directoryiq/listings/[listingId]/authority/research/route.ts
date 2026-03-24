export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { AuthorityRouteError, authorityReqId } from "@/app/api/directoryiq/_utils/authorityErrors";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { createDirectoryIqJob, runDirectoryIqJob } from "@/app/api/directoryiq/_utils/jobs";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";
import { getAuthorityPosts, upsertAuthorityStep2ResearchContract } from "@/app/api/directoryiq/_utils/selectionData";
import { hasUsableStep2ResearchArtifact, type Step2ResearchState } from "@/lib/directoryiq/step2ResearchGateContract";

type Step2ResearchContractPayload = {
  slot: number;
  step2_contract: {
    mission_plan_slot: Record<string, unknown>;
    support_brief: Record<string, unknown>;
    seo_package: Record<string, unknown>;
    research_artifact: Record<string, unknown>;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseContracts(value: unknown): Step2ResearchContractPayload[] {
  if (!Array.isArray(value)) return [];
  const parsed: Step2ResearchContractPayload[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    const slotRaw = record.slot;
    const slot = typeof slotRaw === "number" ? slotRaw : Number(slotRaw);
    const step2Contract = asRecord(record.step2_contract);
    const missionPlanSlot = asRecord(step2Contract.mission_plan_slot);
    const supportBrief = asRecord(step2Contract.support_brief);
    const seoPackage = asRecord(step2Contract.seo_package);
    const researchArtifact = asRecord(step2Contract.research_artifact);
    if (!Number.isFinite(slot)) continue;
    parsed.push({
      slot,
      step2_contract: {
        mission_plan_slot: missionPlanSlot,
        support_brief: supportBrief,
        seo_package: seoPackage,
        research_artifact: researchArtifact,
      },
    });
  }
  return parsed;
}

function hasAnyUsableResearchContract(contracts: Step2ResearchContractPayload[]): boolean {
  return contracts.some((entry) => hasUsableStep2ResearchArtifact(entry.step2_contract.research_artifact));
}

function deriveCanonicalResearchState(posts: Array<{ metadata_json: Record<string, unknown> | null }>): Step2ResearchState {
  let hasQueued = false;
  let hasResearching = false;
  let hasFailed = false;

  for (const post of posts) {
    const metadata = asRecord(post.metadata_json);
    const contract = asRecord(metadata.step2_contract);
    if (hasUsableStep2ResearchArtifact(contract.research_artifact)) return "ready";

    const researchState = asString(asRecord(metadata.step2_research).state);
    if (researchState === "researching") hasResearching = true;
    if (researchState === "queued") hasQueued = true;
    if (researchState === "failed") hasFailed = true;
  }

  if (hasResearching) return "researching";
  if (hasQueued) return "queued";
  if (hasFailed) return "failed";
  return "not_started";
}

function toResponseContracts(contracts: Step2ResearchContractPayload[]): Array<{
  slot: number;
  step2_contract: Step2ResearchContractPayload["step2_contract"];
}> {
  return contracts.map((entry) => ({
    slot: entry.slot,
    step2_contract: entry.step2_contract,
  }));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> | { listingId: string } }
) {
  const reqId = authorityReqId();
  const userId = await requireDirectoryIqWriteUser(req);
  const { listingId } = await Promise.resolve(params);
  const resolvedListingId = decodeURIComponent(listingId);
  const siteId = req.nextUrl.searchParams.get("site_id")?.trim() || null;

  const body = (await req.json().catch(() => ({}))) as { contracts?: unknown };
  const contracts = parseContracts(body.contracts);
  if (!contracts.length || !hasAnyUsableResearchContract(contracts)) {
    return NextResponse.json(
      {
        error: {
          message: "Step 2 research contracts are required.",
          code: "BAD_REQUEST",
          reqId,
        },
      },
      { status: 400 }
    );
  }

  const normalizedContracts: Step2ResearchContractPayload[] = [];
  try {
    for (const entry of contracts) {
      normalizedContracts.push({
        slot: normalizeSlot(String(entry.slot)),
        step2_contract: entry.step2_contract,
      });
    }
  } catch (error) {
    if (error instanceof AuthorityRouteError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code,
            reqId,
            details: error.details,
          },
        },
        { status: error.status }
      );
    }
    throw error;
  }

  const resolved = await resolveListingEvaluation({
    userId,
    listingId: resolvedListingId,
    siteId,
  });
  if (!resolved || !resolved.listingEval.listing) {
    return NextResponse.json(
      {
        error: {
          message: "Listing not found.",
          code: "NOT_FOUND",
          reqId,
        },
      },
      { status: 404 }
    );
  }

  const listingSourceId = resolved.listingEval.listing.source_id;
  const existingPosts = await getAuthorityPosts(userId, listingSourceId);
  const canonicalState = deriveCanonicalResearchState(existingPosts);
  if (canonicalState === "ready") {
    return NextResponse.json(
      {
        ok: true,
        reqId,
        state: "ready",
        contracts: toResponseContracts(normalizedContracts),
      },
      { status: 200 }
    );
  }

  const job = await createDirectoryIqJob({
    reqId,
    userId,
    kind: "step2.research",
    listingId: resolvedListingId,
    siteId,
    slot: null,
  });

  runDirectoryIqJob(job, {
    routeOrigin: "directoryiq.authority.step2.research",
    runtimeOwner: "directoryiq-api.ibrains.ai",
    startedStage: "researching",
    processor: async ({ setStage }) => {
      for (const entry of normalizedContracts) {
        await upsertAuthorityStep2ResearchContract(userId, listingSourceId, entry.slot, {
          contract: null,
          state: "queued",
          errorCode: null,
          errorMessage: null,
        });
      }

      await setStage("researching");
      for (const entry of normalizedContracts) {
        await upsertAuthorityStep2ResearchContract(userId, listingSourceId, entry.slot, {
          contract: entry.step2_contract,
          state: "researching",
          errorCode: null,
          errorMessage: null,
        });
      }

      await setStage("persisting");
      for (const entry of normalizedContracts) {
        await upsertAuthorityStep2ResearchContract(userId, listingSourceId, entry.slot, {
          contract: entry.step2_contract,
          state: "ready",
          errorCode: null,
          errorMessage: null,
        });
      }

      return {
        ok: true,
        reqId,
        state: "ready",
        contracts: toResponseContracts(normalizedContracts),
      };
    },
  });

  return NextResponse.json(
    {
      jobId: job.id,
      reqId: job.reqId,
      acceptedAt: job.acceptedAt,
      status: job.status,
      statusEndpoint: `/api/directoryiq/jobs/${encodeURIComponent(job.id)}`,
    },
    { status: 202 }
  );
}
