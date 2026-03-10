"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type ListingDetailPayload = ListingDetailResponse | { data?: Partial<ListingDetailResponse> };

type IntegrationStatusResponse = {
  openaiConfigured: boolean | null;
  bdConfigured: boolean | null;
};

type ListingSupportSummary = {
  inboundLinkedSupportCount: number;
  mentionWithoutLinkCount: number;
  outboundSupportLinkCount: number;
  connectedSupportPageCount: number;
  lastGraphRunAt: string | null;
};

type ListingSupportInbound = {
  sourceId: string;
  sourceType: "blog_post" | "page" | "support";
  title: string | null;
  url?: string | null;
  anchors: string[];
  relationshipType: "links_to_listing";
};

type ListingSupportMention = {
  sourceId: string;
  sourceType: "blog_post" | "page" | "support";
  title: string | null;
  url?: string | null;
  mentionSnippet?: string | null;
  relationshipType: "mentions_without_link";
};

type ListingSupportOutbound = {
  targetId?: string | null;
  targetType?: "blog_post" | "page" | "support" | null;
  title?: string | null;
  url?: string | null;
  relationshipType: "listing_links_out";
};

type ListingSupportConnectedPage = {
  id?: string | null;
  type: "hub" | "category" | "location" | "support" | "page";
  title: string | null;
  url?: string | null;
};

type ListingSupportModel = {
  listing: {
    id: string;
    title: string;
    canonicalUrl?: string | null;
    siteId?: string | null;
  };
  summary: ListingSupportSummary;
  inboundLinkedSupport: ListingSupportInbound[];
  mentionsWithoutLinks: ListingSupportMention[];
  outboundSupportLinks: ListingSupportOutbound[];
  connectedSupportPages: ListingSupportConnectedPage[];
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
  status?: number;
  listingId?: string;
};

function parseError(json: ApiErrorShape, fallback: string, status?: number, listingId?: string): UiError {
  return {
    message: json.error?.message ?? fallback,
    reqId: json.error?.reqId,
    code: json.error?.code,
    status,
    listingId,
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
  const searchParams = useSearchParams();
  const siteIdParam = searchParams.get("site_id");
  const siteQuery = siteIdParam ? `?site_id=${encodeURIComponent(siteIdParam)}` : "";
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
  const [support, setSupport] = useState<ListingSupportModel | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  async function loadListingAndIntegrations() {
    if (!effectiveListingId) return;
    setError(null);

    try {
      const [listingRes, integrationRes] = await Promise.all([
        fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}${siteQuery}`, { cache: "no-store" }),
        fetch("/api/directoryiq/integrations", { cache: "no-store" }),
      ]);

      const listingJson = (await listingRes.json().catch(() => ({}))) as ListingDetailPayload & ApiErrorShape;
      const integrationJson = (await integrationRes.json().catch(() => ({}))) as IntegrationStatusResponse & ApiErrorShape;
      const listingPayload =
        (listingJson as ListingDetailResponse).listing ??
        (listingJson as { data?: ListingDetailResponse }).data?.listing;
      const evaluationPayload =
        (listingJson as ListingDetailResponse).evaluation ??
        (listingJson as { data?: ListingDetailResponse }).data?.evaluation;

      if (!listingRes.ok || !listingPayload) {
        setError(parseError(listingJson, "Failed to load listing details.", listingRes.status, effectiveListingId));
        setListing(null);
      } else {
        setListing({
          listing: listingPayload,
          evaluation: evaluationPayload ?? { totalScore: 0 },
        });
      }

      if (!integrationRes.ok) {
        setIntegrations((prev) => ({
          openaiConfigured: prev.openaiConfigured,
          bdConfigured: prev.bdConfigured,
        }));
      } else {
        setIntegrations({
          openaiConfigured: Boolean(integrationJson.openaiConfigured),
          bdConfigured: Boolean(integrationJson.bdConfigured),
        });
      }

      try {
        const supportRes = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/support${siteQuery}`, {
          cache: "no-store",
        });
        const supportJson = (await supportRes.json().catch(() => ({}))) as {
          support?: ListingSupportModel;
          error?: { message?: string } | string;
        };
        if (!supportRes.ok) {
          const supportMessage =
            typeof supportJson.error === "string" ? supportJson.error : supportJson.error?.message ?? "Failed to load support model.";
          setSupportError(supportMessage);
          setSupport(null);
        } else {
          setSupport(supportJson.support ?? null);
          setSupportError(null);
        }
      } catch (supportErr) {
        const message = supportErr instanceof Error ? supportErr.message : "Failed to load support model.";
        setSupportError(message);
        setSupport(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load listing details.";
      setError({ message, status: 0, listingId: effectiveListingId });
      setListing(null);
    }
  }

  useEffect(() => {
    void loadListingAndIntegrations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveListingId, siteQuery]);

  async function generateUpgrade() {
    if (!effectiveListingId) return;

    setState("generating");
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/generate${siteQuery}`, {
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

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/preview${siteQuery}`, {
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

    const res = await fetch(`/api/directoryiq/listings/${encodeURIComponent(effectiveListingId)}/upgrade/push${siteQuery}`, {
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

  const fallbackId = effectiveListingId || (listingId && listingId !== "undefined" && listingId !== "null" ? listingId : "");
  const displayName =
    listing?.listing.listing_name?.trim() ||
    listing?.listing.listing_name ||
    (fallbackId ? `Listing #${fallbackId}` : "Listing");
  const displayUrl = listing?.listing.listing_url ?? null;
  const displayScore = listing?.evaluation.totalScore ?? 0;
  const supportSummary = support?.summary ?? {
    inboundLinkedSupportCount: 0,
    mentionWithoutLinkCount: 0,
    outboundSupportLinkCount: 0,
    connectedSupportPageCount: 0,
    lastGraphRunAt: null,
  };

  return (
    <>
      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listing Optimization"]} searchPlaceholder="Search listing optimization..." />

      <ListingHero
        title={displayName}
        subtitle={displayUrl ?? undefined}
        imageUrl={listing?.listing.mainImageUrl ?? null}
        score={displayScore}
        chips={[
          {
            label:
              integrations.openaiConfigured === null
                ? "OpenAI Status Pending"
                : integrations.openaiConfigured
                  ? "OpenAI Connected"
                  : "OpenAI Missing",
            tone: integrations.openaiConfigured === null ? "neutral" : integrations.openaiConfigured ? "good" : "warn",
          },
          {
            label:
              integrations.bdConfigured === null
                ? "BD Status Pending"
                : integrations.bdConfigured
                  ? "BD Connected"
                  : "BD Missing",
            tone: integrations.bdConfigured === null ? "neutral" : integrations.bdConfigured ? "good" : "warn",
          },
        ]}
      />

      {integrations.openaiConfigured === false ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          OpenAI not configured. Configure it in{" "}
          <Link href="/directoryiq/signal-sources?connector=openai" className="underline">Signal Sources</Link>.
        </div>
      ) : null}

      {integrations.bdConfigured === false ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Brilliant Directories not configured. Configure it in{" "}
          <Link href="/directoryiq/signal-sources?connector=brilliant-directories" className="underline">Signal Sources</Link>.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error.message}
          {error.status !== undefined ? ` (status: ${error.status})` : ""}
          {error.listingId ? ` (listing: ${error.listingId})` : ""}
          {error.reqId ? ` (reqId: ${error.reqId})` : ""}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <HudCard title="Current Support" subtitle="Current authority relationships reinforcing this listing.">
        {supportError ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {supportError}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Supporting Links In</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.inboundLinkedSupportCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions Without Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.mentionWithoutLinkCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Outbound Support Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.outboundSupportLinkCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Connected Support Pages</div>
            <div className="mt-1 text-2xl font-semibold text-slate-100">{supportSummary.connectedSupportPageCount}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {supportSummary.lastGraphRunAt
            ? `Last graph refresh: ${new Date(supportSummary.lastGraphRunAt).toLocaleString()}`
            : "Last graph refresh: Not available yet."}
        </div>

        <div className="mt-5 space-y-5">
          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Inbound Linked Support</div>
            <div className="mt-2 space-y-2">
              {support?.inboundLinkedSupport?.length ? (
                support.inboundLinkedSupport.map((item) => (
                  <div key={`${item.sourceId}-${item.url ?? ""}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.sourceId}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.sourceType} · Anchors: {item.anchors.length ? item.anchors.join(", ") : "None captured"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No inbound linked support detected yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Mentions Without Links</div>
            <div className="mt-2 space-y-2">
              {support?.mentionsWithoutLinks?.length ? (
                support.mentionsWithoutLinks.map((item) => (
                  <div key={`${item.sourceId}-${item.url ?? ""}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.sourceId}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.sourceType} · {item.mentionSnippet ?? "No snippet captured"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No unlinked mentions detected yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Listing Outbound Support Links</div>
            <div className="mt-2 space-y-2">
              {support?.outboundSupportLinks?.length ? (
                support.outboundSupportLinks.map((item, index) => (
                  <div key={`${item.targetId ?? "target"}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.url ?? "Support link"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.targetType ?? "support"} · Listing links out</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No outbound support links detected yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Connected Support Pages</div>
            <div className="mt-2 space-y-2">
              {support?.connectedSupportPages?.length ? (
                support.connectedSupportPages.map((item, index) => (
                  <div key={`${item.id ?? "support"}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-slate-100">{item.title ?? item.id ?? "Support page"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.url ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.type}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No connected support pages detected yet.</div>
              )}
            </div>
          </section>
        </div>
      </HudCard>

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
