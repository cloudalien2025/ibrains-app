"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/ecomviper/TopBar";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import ListingHero from "@/components/directoryiq/ListingHero";

type UiState = "idle" | "generating" | "generated" | "previewing" | "ready_to_push" | "pushing" | "done";

type ListingDetailResponse = {
  listing: {
    listing_id: string;
    listing_name: string;
    listing_url: string | null;
    mainImageUrl: string | null;
  };
  evaluation: {
    totalScore: number;
  };
};

type IntegrationStatusResponse = {
  openaiConfigured: boolean;
  bdConfigured: boolean;
};

type DiffRow = {
  left: string;
  right: string;
  type: "same" | "added" | "removed" | "changed";
};

type ApiErrorShape = {
  error?: {
    message?: string;
    code?: string;
    reqId?: string;
    details?: string;
  };
};

type UiError = {
  message: string;
  reqId?: string;
  code?: string;
};

function parseError(json: ApiErrorShape, fallback: string): UiError {
  return {
    message: json.error?.message ?? fallback,
    reqId: json.error?.reqId,
    code: json.error?.code,
  };
}

type ListingOptimizationClientProps = {
  listingId: string;
  initialListing: ListingDetailResponse | null;
  initialIntegrations: IntegrationStatusResponse;
  initialError?: UiError | null;
};

export default function ListingOptimizationClient({
  listingId,
  initialListing,
  initialIntegrations,
  initialError = null,
}: ListingOptimizationClientProps) {
  const hasValidListingId = Boolean(listingId) && listingId !== "undefined" && listingId !== "null";
  const effectiveListingId = hasValidListingId ? listingId : "";
  const [state, setState] = useState<UiState>("idle");
  const [listing, setListing] = useState<ListingDetailResponse | null>(initialListing);
  const [integrations, setIntegrations] = useState<IntegrationStatusResponse>(initialIntegrations);
  const [proposedDescription, setProposedDescription] = useState("");
  const [draftId, setDraftId] = useState("");
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [approvalToken, setApprovalToken] = useState("");
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(initialError);

  async function loadListingAndIntegrations() {
    if (!effectiveListingId) return;
    setError(null);

    const [listingRes, integrationRes] = await Promise.all([
      fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}`, { cache: "no-store" }),
      fetch("/api/directoryiq/integrations", { cache: "no-store" }),
    ]);

    const listingJson = (await listingRes.json().catch(() => ({}))) as ListingDetailResponse & ApiErrorShape;
    const integrationJson = (await integrationRes.json().catch(() => ({}))) as IntegrationStatusResponse & ApiErrorShape;

    if (!listingRes.ok) {
      setError(parseError(listingJson, "Failed to load listing details."));
      setListing(null);
    } else {
      setListing(listingJson);
    }

    if (!integrationRes.ok) {
      setIntegrations({ openaiConfigured: false, bdConfigured: false });
    } else {
      setIntegrations({
        openaiConfigured: integrationJson.openaiConfigured,
        bdConfigured: integrationJson.bdConfigured,
      });
    }
  }

  useEffect(() => {
    void loadListingAndIntegrations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveListingId]);

  async function generateUpgrade() {
    if (!effectiveListingId) return;

    setState("generating");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "default" }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      draftId?: string;
      proposedDescription?: string;
    } & ApiErrorShape;

    if (!res.ok) {
      setState("idle");
      setError(parseError(json, "Failed to generate upgrade."));
      return;
    }

    setDraftId(json.draftId ?? "");
    setProposedDescription(json.proposedDescription ?? "");
    setDiffRows([]);
    setApprovalToken("");
    setApproved(false);
    setState("generated");
    setNotice("Upgrade draft generated.");
  }

  async function previewChanges() {
    if (!effectiveListingId || !draftId) return;

    setState("previewing");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      diff?: DiffRow[];
      approvalToken?: string;
    } & ApiErrorShape;

    if (!res.ok) {
      setState("generated");
      setError(parseError(json, "Failed to preview changes."));
      return;
    }

    setDiffRows(json.diff ?? []);
    setApprovalToken(json.approvalToken ?? "");
    setApproved(false);
    setState("ready_to_push");
  }

  async function approveAndPush() {
    if (!effectiveListingId || !draftId) return;

    setState("pushing");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        approved: true,
        approvalToken,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as ApiErrorShape;

    if (!res.ok) {
      setState("ready_to_push");
      setError(parseError(json, "Failed to push upgrade to BD."));
      return;
    }

    setState("done");
    setNotice("Listing upgrade pushed successfully.");
    await loadListingAndIntegrations();
  }

  const displayName = listing?.listing.listing_name || effectiveListingId || "Listing";
  const displayUrl = listing?.listing.listing_url ?? null;
  const displayScore = listing?.evaluation.totalScore ?? 0;

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listing Optimization"]} searchPlaceholder="Search listing optimization..." />

      <ListingHero
        title={displayName}
        subtitle={displayUrl ?? undefined}
        imageUrl={listing?.listing.mainImageUrl ?? null}
        score={displayScore}
        chips={[
          { label: integrations.openaiConfigured ? "OpenAI Connected" : "OpenAI Missing", tone: integrations.openaiConfigured ? "good" : "warn" },
          { label: integrations.bdConfigured ? "BD Connected" : "BD Missing", tone: integrations.bdConfigured ? "good" : "warn" },
        ]}
      />

      {!integrations.openaiConfigured ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          OpenAI not configured. Configure it in{" "}
          <Link href="/directoryiq/settings/integrations" className="underline">DirectoryIQ Integrations</Link>.
        </div>
      ) : null}

      {!integrations.bdConfigured ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Brilliant Directories not configured. Configure it in{" "}
          <Link href="/directoryiq/settings/integrations" className="underline">DirectoryIQ Integrations</Link>.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error.message}
          {error.reqId ? ` (reqId: ${error.reqId})` : ""}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <HudCard
        title="Auto-Generate Listing Upgrade"
        subtitle="Simple 3-step flow: Generate, Preview, Approve & Push."
      >
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap gap-2">
            <NeonButton onClick={() => void generateUpgrade()} disabled={state === "generating"}>
              {state === "generating" ? "Generating..." : "Generate Upgrade"}
            </NeonButton>

            {(state === "generated" || state === "previewing" || state === "ready_to_push" || state === "done") && draftId ? (
              <NeonButton variant="secondary" onClick={() => void previewChanges()} disabled={state === "previewing"}>
                {state === "previewing" ? "Preparing..." : "Preview Changes"}
              </NeonButton>
            ) : null}

            {(state === "generated" || state === "ready_to_push" || state === "done") ? (
              <NeonButton variant="secondary" onClick={() => void generateUpgrade()}>
                Regenerate
              </NeonButton>
            ) : null}
          </div>

          {(state === "generated" || state === "ready_to_push" || state === "done") && proposedDescription ? (
            <details open className="rounded-lg border border-white/10 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">Generated Upgrade</summary>
              <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-900/80 p-3 text-sm text-slate-200">{proposedDescription}</pre>
            </details>
          ) : null}

          {state === "ready_to_push" ? (
            <div className="space-y-3 rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3">
              <h4 className="text-sm font-semibold text-cyan-100">Diff Viewer</h4>
              <div className="max-h-96 overflow-auto rounded border border-white/10">
                {diffRows.map((row, index) => (
                  <div key={`${row.type}-${index}`} className="grid grid-cols-2 gap-2 border-b border-white/10 p-2 text-xs">
                    <div className="rounded bg-slate-900/80 p-2 text-slate-300">{row.left || " "}</div>
                    <div className="rounded bg-slate-900/80 p-2 text-cyan-100">{row.right || " "}</div>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                  className="mt-0.5"
                />
                <span>I reviewed the diff and approve this push.</span>
              </label>

              <NeonButton onClick={() => void approveAndPush()} disabled={!approved || !integrations.bdConfigured}>
                Approve & Push to BD
              </NeonButton>
            </div>
          ) : null}
        </div>
      </HudCard>
    </>
  );
}
