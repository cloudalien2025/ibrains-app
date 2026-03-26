export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { normalizeSlot } from "@/app/api/directoryiq/_utils/authority";
import { AuthorityRouteError, authorityReqId } from "@/app/api/directoryiq/_utils/authorityErrors";
import { resolveCanonicalListingUrl } from "@/app/api/directoryiq/_utils/canonicalListingUrl";
import { resolveListingEvaluation } from "@/app/api/directoryiq/_utils/listingResolve";
import { createDirectoryIqJob, runDirectoryIqJob } from "@/app/api/directoryiq/_utils/jobs";
import { getAuthorityPosts, upsertAuthorityStep2ResearchContract } from "@/app/api/directoryiq/_utils/selectionData";
import { requireDirectoryIqWriteUser } from "@/app/api/directoryiq/_utils/writeAuth";
import { getDirectoryIqRuntimeStamp } from "@/app/api/directoryiq/_utils/runtimeStamp";
import { getSerpApiKeyForUser } from "@/app/api/directoryiq/_utils/integrations";
import {
  buildStep2SelectionResearchDossierPhase1,
  isDossierBackedResearchArtifact,
  type DossierBackedStep2Contract,
} from "@/lib/directoryiq/step2ResearchDossierEngine";
import {
  classifyStep2ResearchReadiness,
  hasUsableStep2ResearchArtifact,
  type Step2ResearchState,
} from "@/lib/directoryiq/step2ResearchGateContract";
import { getListingCurrentSupport } from "@/src/directoryiq/services/listingSupportService";

type Step2ResearchContractPayload = {
  slot: number;
  mission_plan_slot: Record<string, unknown>;
};

type AuthorityPostResearchRow = {
  slot_index?: number;
  metadata_json?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableString(value: unknown): string | null {
  const parsed = asString(value);
  return parsed || null;
}

function asLocation(raw: Record<string, unknown>): { city: string | null; region: string | null } {
  const city =
    toNullableString(raw.post_location) ??
    toNullableString(raw.city) ??
    toNullableString(raw.locality) ??
    toNullableString(raw.location_city);
  const region =
    toNullableString(raw.location_region) ??
    toNullableString(raw.region) ??
    toNullableString(raw.state) ??
    toNullableString(raw.location_state);
  return { city, region };
}

function readCategory(raw: Record<string, unknown>): string | null {
  const primaryCategory = raw.primary_category;
  const candidates = [
    asString(raw.group_category),
    asString(raw.category),
    asString(raw.category_name),
    typeof primaryCategory === "string" ? primaryCategory : asString((primaryCategory as Record<string, unknown> | undefined)?.name),
    asString(raw.listing_category),
  ];
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (normalized) return normalized;
  }
  return null;
}

function readDescription(raw: Record<string, unknown>): string | null {
  const description =
    asString(raw.group_desc) ||
    asString(raw.short_description) ||
    asString(raw.description) ||
    asString(raw.content) ||
    asString((raw.content as Record<string, unknown> | undefined)?.rendered) ||
    asString(raw.excerpt);
  return description.trim() ? description.trim() : null;
}

function stripSitePrefix(input: string): string {
  const value = input.trim();
  if (!value.includes(":")) return value;
  const [, tail] = value.split(":", 2);
  return tail?.trim() || value;
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
    if (!Number.isFinite(slot)) continue;
    parsed.push({
      slot,
      mission_plan_slot: missionPlanSlot,
    });
  }
  return parsed;
}

function isRealDossierContract(contract: Record<string, unknown>): boolean {
  const dossier = asRecord(contract.research_dossier);
  const listingIdentity = asRecord(dossier.listing_identity);
  const ownerKey = asString(dossier.owner_key);
  const slotResearch = Array.isArray(dossier.step2_slot_research) ? dossier.step2_slot_research : [];
  if (!ownerKey || !asString(listingIdentity.listing_source_id) || slotResearch.length === 0) return false;

  const researchArtifact = asRecord(contract.research_artifact);
  return hasUsableStep2ResearchArtifact(researchArtifact) && isDossierBackedResearchArtifact(researchArtifact);
}

function deriveCanonicalResearchState(input: {
  posts: AuthorityPostResearchRow[];
}): {
  state: Step2ResearchState;
  contracts: DossierBackedStep2Contract[];
} {
  let hasQueued = false;
  let hasResearching = false;
  let hasFailed = false;
  const readyContracts: DossierBackedStep2Contract[] = [];

  for (const post of input.posts) {
    const metadata = asRecord(post.metadata_json);
    const contract = asRecord(metadata.step2_contract);
    if (isRealDossierContract(contract)) {
      readyContracts.push({
        slot: typeof post.slot_index === "number" ? post.slot_index : 0,
        step2_contract: contract as DossierBackedStep2Contract["step2_contract"],
      });
      continue;
    }

    const researchState = asString(asRecord(metadata.step2_research).state);
    if (researchState === "researching") hasResearching = true;
    if (researchState === "queued") hasQueued = true;
    if (researchState === "failed") hasFailed = true;
  }

  if (readyContracts.length > 0) {
    const contracts = readyContracts
      .filter((entry) => entry.slot > 0)
      .sort((left, right) => left.slot - right.slot);
    const readiness = contracts.every((entry) => classifyStep2ResearchReadiness(entry.step2_contract.research_artifact) === "grounded")
      ? "ready_grounded"
      : "ready_thin";
    return {
      state: readiness,
      contracts,
    };
  }
  if (hasResearching) return { state: "researching", contracts: [] };
  if (hasQueued) return { state: "queued", contracts: [] };
  if (hasFailed) return { state: "failed", contracts: [] };
  return { state: "not_started", contracts: [] };
}

function toResponseContracts(contracts: DossierBackedStep2Contract[]): Array<{
  slot: number;
  step2_contract: DossierBackedStep2Contract["step2_contract"];
}> {
  return contracts.map((entry) => ({
    slot: entry.slot,
    step2_contract: entry.step2_contract,
  }));
}

function derivePersistedReadyState(contract: Record<string, unknown>): Extract<Step2ResearchState, "ready_thin" | "ready_grounded"> {
  return classifyStep2ResearchReadiness(contract.research_artifact) === "grounded" ? "ready_grounded" : "ready_thin";
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
  if (!contracts.length) {
    return NextResponse.json(
      {
        error: {
          message: "Step 2 research contracts are required.",
          code: "BAD_REQUEST",
          reqId,
        },
        runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
      },
      { status: 400 }
    );
  }

  const normalizedContracts: Step2ResearchContractPayload[] = [];
  try {
    for (const entry of contracts) {
      normalizedContracts.push({
        slot: normalizeSlot(String(entry.slot)),
        mission_plan_slot: entry.mission_plan_slot,
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
          runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
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
        runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
      },
      { status: 404 }
    );
  }

  const listing = resolved.listingEval.listing;
  const listingSourceId = asString(listing.source_id) || resolvedListingId;
  const raw = asRecord(listing.raw_json);
  const canonicalListingUrl = resolveCanonicalListingUrl(raw, listing.url);
  const listingCanonicalId = asString(raw.listing_id) || stripSitePrefix(listingSourceId) || resolvedListingId;
  const listingTitle = asString(raw.group_name) || asString(listing.title) || listingCanonicalId;
  const { city, region } = asLocation(raw);

  const existingPosts = (await getAuthorityPosts(userId, listingSourceId)) as AuthorityPostResearchRow[];
  const canonicalState = deriveCanonicalResearchState({ posts: existingPosts });
  if (canonicalState.state === "ready_grounded" || canonicalState.state === "ready_thin") {
    return NextResponse.json(
      {
        ok: true,
        reqId,
        state: canonicalState.state,
        contracts: toResponseContracts(canonicalState.contracts),
        runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
      },
      { status: canonicalState.state === "ready_grounded" ? 200 : 202 }
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

      const supportModel = await getListingCurrentSupport({
        tenantId: userId,
        listingId: listingCanonicalId,
        listingLookupIds: Array.from(
          new Set([
            listingCanonicalId,
            resolvedListingId,
            listingSourceId,
            resolved.siteId ? `${resolved.siteId}:${listingCanonicalId}` : null,
          ].filter((value): value is string => typeof value === "string" && value.trim().length > 0))
        ),
        listingTitle,
        listingUrl: canonicalListingUrl,
        siteId: resolved.siteId,
      }).catch(() => ({
        listing: {
          id: listingCanonicalId,
          title: listingTitle,
          canonicalUrl: canonicalListingUrl,
          siteId: resolved.siteId,
        },
        summary: {
          inboundLinkedSupportCount: 0,
          mentionWithoutLinkCount: 0,
          outboundSupportLinkCount: 0,
          connectedSupportPageCount: 0,
          lastGraphRunAt: null,
        },
        inboundLinkedSupport: [],
        mentionsWithoutLinks: [],
        outboundSupportLinks: [],
        connectedSupportPages: [],
      }));

      const generatedAtIso = new Date().toISOString();
      const dossierBundle = await buildStep2SelectionResearchDossierPhase1({
        generatedAtIso,
        listing: {
          listing_source_id: listingSourceId,
          listing_id: listingCanonicalId,
          listing_title: listingTitle,
          listing_url: canonicalListingUrl,
          site_id: resolved.siteId,
          category: readCategory(raw),
          location_city: city,
          location_region: region,
          listing_description: readDescription(raw),
          listing_type: toNullableString(raw.listing_type),
        },
        sameSiteSupport: supportModel,
        slots: normalizedContracts.map((entry) => ({
          slot: entry.slot,
          missionPlanSlot: entry.mission_plan_slot,
        })),
        serpApiKey: await getSerpApiKeyForUser(userId),
      });

      const usableContracts = dossierBundle.contracts.filter((entry) => isRealDossierContract(entry.step2_contract as Record<string, unknown>));
      if (!usableContracts.length) {
        for (const entry of normalizedContracts) {
          await upsertAuthorityStep2ResearchContract(userId, listingSourceId, entry.slot, {
            contract: null,
            state: "failed",
            errorCode: "DOSSIER_EMPTY",
            errorMessage: "Research dossier could not produce a usable listing-backed artifact.",
          });
        }
        return {
          ok: false,
          reqId,
          state: "failed",
          contracts: [],
        };
      }

      await setStage("persisting");
      for (const entry of dossierBundle.contracts) {
        const readyState = derivePersistedReadyState(entry.step2_contract as Record<string, unknown>);
        await upsertAuthorityStep2ResearchContract(userId, listingSourceId, entry.slot, {
          contract: entry.step2_contract as unknown as Record<string, unknown>,
          state: readyState,
          errorCode: null,
          errorMessage: null,
        });
      }

      const resultState: Step2ResearchState = usableContracts.every(
        (entry) => derivePersistedReadyState(entry.step2_contract as Record<string, unknown>) === "ready_grounded"
      )
        ? "ready_grounded"
        : "ready_thin";

      return {
        ok: true,
        reqId,
        state: resultState,
        contracts: toResponseContracts(dossierBundle.contracts),
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
      runtime: getDirectoryIqRuntimeStamp("directoryiq-api.ibrains.ai"),
    },
    { status: 202 }
  );
}
