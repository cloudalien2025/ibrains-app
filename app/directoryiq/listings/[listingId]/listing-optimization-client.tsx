"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import HudCard from "@/components/ecomviper/HudCard";
import TopBar from "@/components/ecomviper/TopBar";
import NeonButton from "@/components/ecomviper/NeonButton";
import ListingHero from "@/components/directoryiq/ListingHero";

type Cap = { kind: string; cap: number; reason: string };

type ListingDetail = {
  listing: {
    listing_id: string;
    listing_name: string;
    listing_url: string | null;
    mainImageUrl: string | null;
  };
  evaluation: {
    totalScore: number;
    scores: {
      structure: number;
      clarity: number;
      trust: number;
      authority: number;
      actionability: number;
    };
    flags: {
      structuralGateActive: boolean;
      structuralHardFailActive: boolean;
      authorityCeilingActive: boolean;
      ambiguityPenaltyApplied: boolean;
      trustRiskCapActive: boolean;
    };
    caps: Cap[];
    ambiguityPenalty: number;
  };
  authority_posts: Array<{
    id: string;
    slot: number;
    type: string;
    title: string | null;
    focus_topic: string;
    status: "not_created" | "draft" | "published";
    blog_to_listing_status: "linked" | "missing";
    listing_to_blog_status: "linked" | "missing";
    featured_image_url: string | null;
    published_url: string | null;
    updated_at: string;
  }>;
  integrations?: {
    brilliant_directories?: boolean;
    openai?: boolean;
  };
};

type BlueprintResponse = {
  blueprint: {
    structure: string[];
    clarity: string[];
    trust: string[];
    authority: string[];
    actionability: string[];
  };
};

type PreviewResponse = {
  preview: {
    listing_changes?: Array<{ section: string; before: string; after: string }>;
    blog_changes?: Array<{ section: string; before: string; after: string }>;
    featured_image_preview?: string | null;
    inserted_links?: {
      blog_to_listing: { status: string; anchor_text?: string; location?: string };
      listing_to_blog: { status: string; placement?: string };
    };
    score_delta?: { before: number; after: number; cap_changes?: Cap[] };
  };
  approval_token?: string;
};

type UpgradeDiffRow = {
  left: string;
  right: string;
  type: "same" | "added" | "removed" | "changed";
};

type ApiErrorPayload = {
  error?:
    | string
    | {
        message?: string;
        code?: string;
        reqId?: string;
        details?: string;
      };
  validation_errors?: string[];
};

type UiError = {
  message: string;
  code?: string;
  reqId?: string;
  details?: string;
};

function clientReqId(action: string, slot?: number): string {
  return `client-${action}-${slot ?? 0}-${Date.now()}`;
}

function parseApiError(json: ApiErrorPayload, fallback: string): UiError {
  if (Array.isArray(json.validation_errors) && json.validation_errors.length > 0) {
    return { message: json.validation_errors.join(" ") };
  }
  if (typeof json.error === "string") return { message: json.error };
  if (json.error && typeof json.error === "object") {
    return {
      message: json.error.message || fallback,
      code: json.error.code,
      reqId: json.error.reqId,
      details: json.error.details,
    };
  }
  return { message: fallback };
}

function PillarBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function humanPostStatus(status: "not_created" | "draft" | "published"): string {
  if (status === "not_created") return "Not Created";
  if (status === "draft") return "Draft Ready";
  return "Published";
}

function humanLinkStatus(status: "linked" | "missing"): string {
  return status === "linked" ? "Linked" : "Missing";
}

function DiffPreview({ preview, onApprove, approveLabel }: { preview: PreviewResponse["preview"] | null; onApprove: () => Promise<void>; approveLabel: string }) {
  const [busy, setBusy] = useState(false);

  if (!preview) return null;

  return (
    <HudCard title="Diff Preview" subtitle="Approval required before any write action.">
      <div className="mb-4 rounded-lg border border-white/10 p-3 text-sm text-slate-200">
        {preview.score_delta ? (
          <div>Score Delta: {preview.score_delta.before} → {preview.score_delta.after}</div>
        ) : (
          <div>Review proposed content and link updates before approval.</div>
        )}
      </div>

      <details className="mb-4 rounded-lg border border-white/10 p-3 text-xs text-slate-200">
        <summary className="cursor-pointer text-cyan-200">Details</summary>

        {preview.listing_changes?.length ? (
          <div className="mt-3 space-y-3">
            <div className="text-xs uppercase tracking-[0.08em] text-cyan-200">Listing changes</div>
            {preview.listing_changes.map((change, index) => (
              <div key={`${change.section}-${index}`} className="rounded-lg border border-white/10 p-3">
                <div className="mb-2 text-xs text-slate-400">{change.section}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <pre className="max-h-44 overflow-auto rounded bg-slate-900/80 p-2 text-xs text-slate-300">{change.before}</pre>
                  <pre className="max-h-44 overflow-auto rounded bg-slate-900/80 p-2 text-xs text-cyan-100">{change.after}</pre>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {preview.blog_changes?.length ? (
          <div className="mt-3 space-y-3">
            <div className="text-xs uppercase tracking-[0.08em] text-cyan-200">Blog changes</div>
            {preview.blog_changes.map((change, index) => (
              <div key={`${change.section}-${index}`} className="rounded-lg border border-white/10 p-3">
                <div className="mb-2 text-xs text-slate-400">{change.section}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <pre className="max-h-44 overflow-auto rounded bg-slate-900/80 p-2 text-xs text-slate-300">{change.before}</pre>
                  <pre className="max-h-44 overflow-auto rounded bg-slate-900/80 p-2 text-xs text-cyan-100">{change.after}</pre>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {preview.inserted_links ? (
          <div className="mt-3 rounded-lg border border-white/10 p-3 text-xs text-slate-200">
            <div className="mb-2 text-xs uppercase tracking-[0.08em] text-cyan-200">Inserted Links</div>
            <div>Blog → Listing: {preview.inserted_links.blog_to_listing.status}</div>
            <div>Anchor/Location: {preview.inserted_links.blog_to_listing.anchor_text} · {preview.inserted_links.blog_to_listing.location}</div>
            <div className="mt-1">Listing → Blog: {preview.inserted_links.listing_to_blog.status}</div>
            <div>Placement: {preview.inserted_links.listing_to_blog.placement}</div>
          </div>
        ) : null}
      </details>

      <NeonButton
        onClick={async () => {
          setBusy(true);
          try {
            await onApprove();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        {busy ? "Applying..." : approveLabel}
      </NeonButton>
    </HudCard>
  );
}

export default function ListingOptimizationClient() {
  const params = useParams<{ listingId?: string | string[] }>();
  const listingId = useMemo(() => {
    const raw = params?.listingId;
    if (typeof raw === "string" && raw.length > 0) return decodeURIComponent(raw);
    if (Array.isArray(raw) && raw[0]) return decodeURIComponent(raw[0]);
    return "";
  }, [params]);

  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintResponse["blueprint"] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [focusTopicBySlot, setFocusTopicBySlot] = useState<Record<number, string>>({});
  const [titleBySlot, setTitleBySlot] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<PreviewResponse["preview"] | null>(null);
  const [previewAction, setPreviewAction] = useState<null | { type: "listing_push"; proposedDescription: string; token: string } | { type: "blog_publish"; slot: number; token: string }>(null);
  const [upgradeState, setUpgradeState] = useState<
    "idle" | "generating" | "generated" | "previewing" | "ready_to_push" | "pushing" | "done"
  >("idle");
  const [upgradeDraftId, setUpgradeDraftId] = useState<string | null>(null);
  const [upgradeProposedDescription, setUpgradeProposedDescription] = useState<string>("");
  const [upgradeDiff, setUpgradeDiff] = useState<UpgradeDiffRow[] | null>(null);
  const [upgradeApprovalToken, setUpgradeApprovalToken] = useState<string>("");
  const [upgradeApproved, setUpgradeApproved] = useState(false);

  const capIndicators = useMemo(() => {
    if (!detail) return [];
    return [
      ["Structural gate active", detail.evaluation.flags.structuralGateActive || detail.evaluation.flags.structuralHardFailActive],
      ["Authority ceiling active", detail.evaluation.flags.authorityCeilingActive],
      ["Ambiguity penalty applied", detail.evaluation.flags.ambiguityPenaltyApplied],
      ["Trust risk cap active", detail.evaluation.flags.trustRiskCapActive],
    ] as const;
  }, [detail]);

  const heroChips = useMemo(() => {
    if (!detail) return [];
    const structuralActive = detail.evaluation.flags.structuralGateActive || detail.evaluation.flags.structuralHardFailActive;
    return [
      {
        label: `Structural gate: ${structuralActive ? "Yes" : "No"}`,
        tone: structuralActive ? ("warn" as const) : ("good" as const),
      },
      {
        label: `Authority ceiling: ${detail.evaluation.flags.authorityCeilingActive ? "Yes" : "No"}`,
        tone: detail.evaluation.flags.authorityCeilingActive ? ("warn" as const) : ("good" as const),
      },
    ];
  }, [detail]);

  const isGeneratingUpgrade = upgradeState === "generating";
  const isPreviewingUpgrade = upgradeState === "previewing";
  const isPushingUpgrade = upgradeState === "pushing";

  async function load() {
    setError(null);
    if (!listingId) {
      setDetail(null);
      return;
    }
    try {
      const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}`, { cache: "no-store" });
      const json = (await response.json()) as ListingDetail & ApiErrorPayload;
      if (!response.ok) throw parseApiError(json, "Failed to load listing");
      setDetail(json);
      setTitleBySlot((prev) => {
        const next = { ...prev };
        for (const post of json.authority_posts ?? []) {
          if (next[post.slot] == null && post.title) next[post.slot] = post.title;
        }
        return next;
      });
      setFocusTopicBySlot((prev) => {
        const next = { ...prev };
        for (const post of json.authority_posts ?? []) {
          if (next[post.slot] == null && post.focus_topic) next[post.slot] = post.focus_topic;
        }
        return next;
      });
      setUpgradeState("idle");
      setUpgradeDraftId(null);
      setUpgradeProposedDescription("");
      setUpgradeDiff(null);
      setUpgradeApprovalToken("");
      setUpgradeApproved(false);
    } catch (e) {
      if (typeof e === "object" && e && "message" in e) {
        setError(e as UiError);
      } else {
        setError({ message: "Unknown listing error" });
      }
    }
  }

  useEffect(() => {
    if (!listingId) return;
    void load();
  }, [listingId]);

  async function generateBlueprint() {
    setError(null);
    setBusyAction("blueprint");
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/blueprint`, { method: "POST" });
    const json = (await response.json()) as BlueprintResponse & ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Failed to generate blueprint"));
      setBusyAction(null);
      return;
    }
    setBlueprint(json.blueprint);
    setBusyAction(null);
  }

  async function generateDraft(slot: number) {
    setError(null);
    const focusTopic = (focusTopicBySlot[slot] ?? "").trim();
    if (!focusTopic) {
      setError({
        message: "Focus topic is required before generating a draft.",
        code: "VALIDATION_ERROR",
        reqId: clientReqId("draft", slot),
      });
      return;
    }

    setBusyAction(`draft-${slot}`);
    const source = detail?.authority_posts.find((post) => post.slot === slot);
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/authority/${slot}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: source?.type ?? "contextual_guide",
        focus_topic: focusTopic,
        title: titleBySlot[slot],
      }),
    });

    const json = (await response.json()) as ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Draft generation failed"));
      setBusyAction(null);
      return;
    }

    setNotice(`Draft ready for slot ${slot}.`);
    setBusyAction(null);
    await load();
  }

  async function generateImage(slot: number) {
    setError(null);
    const focusTopic = (focusTopicBySlot[slot] ?? "").trim();
    if (!focusTopic) {
      setError({
        message: "Focus topic is required before generating a featured image.",
        code: "VALIDATION_ERROR",
        reqId: clientReqId("image", slot),
      });
      return;
    }

    setBusyAction(`image-${slot}`);
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/authority/${slot}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus_topic: focusTopic }),
    });
    const json = (await response.json()) as ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Image generation failed"));
      setBusyAction(null);
      return;
    }

    setNotice(`Featured image ready for slot ${slot}.`);
    setBusyAction(null);
    await load();
  }

  async function previewBlogPublish(slot: number) {
    setError(null);
    const source = detail?.authority_posts.find((post) => post.slot === slot);
    if (!source || source.status === "not_created") {
      setError({
        message: "Generate a draft before opening preview.",
        code: "VALIDATION_ERROR",
        reqId: clientReqId("preview", slot),
      });
      return;
    }

    setBusyAction(`preview-${slot}`);
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/authority/${slot}/preview`, { method: "POST" });
    const json = (await response.json()) as PreviewResponse & ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Preview failed"));
      setBusyAction(null);
      return;
    }

    setPreview(json.preview);
    setPreviewAction({ type: "blog_publish", slot, token: json.approval_token ?? "" });
    setBusyAction(null);
  }

  async function publishBlog(slot: number, token: string) {
    setError(null);
    setBusyAction(`publish-${slot}`);
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/authority/${slot}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve_publish: true, approval_token: token }),
    });
    const json = (await response.json()) as { version_id?: string } & ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Publish failed"));
      setBusyAction(null);
      return;
    }
    setNotice(`Published. Version ${json.version_id ?? "created"}.`);
    setPreview(null);
    setPreviewAction(null);
    setBusyAction(null);
    await load();
  }

  async function generateUpgrade() {
    setError(null);
    setNotice(null);
    setUpgradeState("generating");
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/upgrade/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "standard" }),
    });
    const json = (await response.json()) as {
      draftId?: string;
      proposedDescription?: string;
    } & ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Upgrade generation failed"));
      setUpgradeState("idle");
      return;
    }

    setUpgradeDraftId(json.draftId ?? null);
    setUpgradeProposedDescription(json.proposedDescription ?? "");
    setUpgradeDiff(null);
    setUpgradeApprovalToken("");
    setUpgradeApproved(false);
    setUpgradeState("generated");
    setNotice("Upgrade draft generated.");
  }

  async function previewUpgrade() {
    if (!upgradeDraftId) {
      setError({ message: "Generate an upgrade before previewing changes.", reqId: clientReqId("upgrade-preview") });
      return;
    }

    setError(null);
    setUpgradeState("previewing");
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/upgrade/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: upgradeDraftId }),
    });
    const json = (await response.json()) as {
      draftId?: string;
      original?: string;
      proposed?: string;
      diff?: UpgradeDiffRow[];
      approvalToken?: string;
    } & ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Upgrade preview failed"));
      setUpgradeState("generated");
      return;
    }

    setUpgradeProposedDescription(json.proposed ?? "");
    setUpgradeDiff(Array.isArray(json.diff) ? json.diff : []);
    setUpgradeApprovalToken(json.approvalToken ?? "");
    setUpgradeApproved(false);
    setUpgradeState("ready_to_push");
    setNotice("Preview ready. Confirm and push when ready.");
  }

  async function pushUpgrade() {
    if (!upgradeDraftId) return;
    if (!upgradeApproved) {
      setError({ message: "Check approval confirmation before pushing.", reqId: clientReqId("upgrade-push") });
      return;
    }

    setError(null);
    setUpgradeState("pushing");
    const response = await fetch(`/api/directoryiq/listings/${encodeURIComponent(listingId)}/upgrade/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: upgradeDraftId, approved: true, approvalToken: upgradeApprovalToken }),
    });
    const json = (await response.json()) as { versionId?: string } & ApiErrorPayload;
    if (!response.ok) {
      setError(parseApiError(json, "Upgrade push failed"));
      setUpgradeState("ready_to_push");
      return;
    }

    setNotice(`Listing pushed. Version ${json.versionId ?? "created"}.`);
    setUpgradeState("done");
    await load();
  }

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Listing Optimization</h1>
        <p className="mt-1 text-sm text-slate-300">
          Review score gaps, improve authority support, then preview before any publish or push.
        </p>
      </section>

      <TopBar breadcrumbs={["Home", "DirectoryIQ", "Listing Optimization"]} searchPlaceholder="Search listing optimization..." />

      {!listingId ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          Listing id is missing from the route.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          <div>{error.message}</div>
          {(error.code || error.reqId || error.details) ? (
            <details className="mt-2 text-xs text-rose-100/90">
              <summary className="cursor-pointer">Details</summary>
              {error.code ? <div>Code: {error.code}</div> : null}
              {error.reqId ? <div>Request ID: {error.reqId}</div> : null}
              {error.details ? <div>Info: {error.details}</div> : null}
            </details>
          ) : null}
        </div>
      ) : null}
      {notice ? <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      {detail ? (
        <>
          <ListingHero
            title={detail.listing.listing_name}
            subtitle="Listing Optimization"
            imageUrl={detail.listing.mainImageUrl}
            score={detail.evaluation.totalScore}
            chips={heroChips}
          />

          <HudCard title="AI Agent Selection Score" subtitle="Selection confidence and pillar breakdown.">
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="rounded-xl border border-cyan-300/15 bg-slate-900/50 p-5 text-center">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Current Score</div>
                <div className="mt-3 text-6xl font-semibold text-cyan-100">{detail.evaluation.totalScore}</div>
              </div>

              <div className="space-y-3">
                <PillarBar label="Structure" value={detail.evaluation.scores.structure} />
                <PillarBar label="Clarity" value={detail.evaluation.scores.clarity} />
                <PillarBar label="Trust" value={detail.evaluation.scores.trust} />
                <PillarBar label="Authority" value={detail.evaluation.scores.authority} />
                <PillarBar label="Actionability" value={detail.evaluation.scores.actionability} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {capIndicators.map(([label, active]) => (
                <span
                  key={label}
                  className={`rounded-full border px-2 py-0.5 ${active ? "border-amber-300/40 bg-amber-400/10 text-amber-100" : "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"}`}
                >
                  {label}: {active ? "Yes" : "No"}
                </span>
              ))}
            </div>
          </HudCard>

          <HudCard
            title="Detected Gaps"
            subtitle="Grouped by pillar"
            actions={
              <NeonButton onClick={generateBlueprint} disabled={busyAction === "blueprint"}>
                {busyAction === "blueprint" ? "Generating..." : "Generate Optimization Blueprint"}
              </NeonButton>
            }
          >
            {blueprint ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(blueprint).map(([pillar, items]) => (
                  <div key={pillar} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.08em] text-cyan-200">{pillar}</div>
                    {(items as string[]).length === 0 ? (
                      <div className="text-sm text-slate-400">No critical gaps detected.</div>
                    ) : (
                      <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
                        {(items as string[]).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-300">Run blueprint generation to view pillar-specific gaps.</div>
            )}

            <section className="mt-6 rounded-xl border border-white/10 p-4">
              <h3 className="text-base font-semibold text-slate-100">Auto-Generate Listing Upgrade</h3>
              <p className="mt-1 text-sm text-slate-300">
                We&apos;ll write an improved listing based on detected gaps. You can preview changes before any push.
              </p>

              {detail.integrations?.openai === false ? (
                <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                  <div>OpenAI not configured.</div>
                  <a
                    href="/directoryiq/settings/integrations"
                    className="mt-2 inline-block rounded-md border border-amber-200/40 px-2 py-1 text-xs text-amber-50 hover:bg-amber-300/15"
                  >
                    Configure OpenAI in Integrations
                  </a>
                </div>
              ) : null}

              {detail.integrations?.brilliant_directories === false ? (
                <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                  <div>Brilliant Directories API not configured.</div>
                  <a
                    href="/directoryiq/settings/integrations"
                    className="mt-2 inline-block rounded-md border border-amber-200/40 px-2 py-1 text-xs text-amber-50 hover:bg-amber-300/15"
                  >
                    Configure Brilliant Directories in Integrations
                  </a>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <NeonButton onClick={() => void generateUpgrade()} disabled={isGeneratingUpgrade}>
                  {isGeneratingUpgrade ? "Generating..." : "Generate Upgrade"}
                </NeonButton>

                {(upgradeState === "generated" || upgradeState === "ready_to_push" || upgradeState === "done") && upgradeDraftId ? (
                  <NeonButton variant="secondary" onClick={() => void previewUpgrade()} disabled={isPreviewingUpgrade}>
                    {isPreviewingUpgrade ? "Preparing..." : "Preview Changes"}
                  </NeonButton>
                ) : null}

                {(upgradeState === "generated" || upgradeState === "ready_to_push" || upgradeState === "done") ? (
                  <NeonButton variant="secondary" onClick={() => void generateUpgrade()} disabled={isGeneratingUpgrade}>
                    Regenerate
                  </NeonButton>
                ) : null}
              </div>

              {(upgradeState === "generated" || upgradeState === "ready_to_push" || upgradeState === "done") && upgradeProposedDescription ? (
                <details className="mt-4 rounded-lg border border-white/10 p-3 text-sm text-slate-200">
                  <summary className="cursor-pointer text-cyan-200">Generated Upgrade</summary>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-900/70 p-3 text-sm text-slate-100">
                    {upgradeProposedDescription}
                  </pre>
                </details>
              ) : null}

              {upgradeState === "ready_to_push" && upgradeDiff ? (
                <div className="mt-4 rounded-lg border border-white/10 p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.08em] text-cyan-200">Diff Viewer</div>
                  <div className="max-h-80 overflow-auto rounded-lg border border-white/10">
                    <div className="grid grid-cols-2 border-b border-white/10 bg-slate-900/70 p-2 text-xs uppercase tracking-[0.08em] text-slate-300">
                      <div>Original listing description</div>
                      <div>Proposed listing description</div>
                    </div>
                    {upgradeDiff.map((row, index) => (
                      <div
                        key={`${index}-${row.type}`}
                        className={`grid grid-cols-2 gap-0 border-b border-white/5 text-sm ${
                          row.type === "changed"
                            ? "bg-cyan-400/10"
                            : row.type === "added"
                              ? "bg-emerald-400/10"
                              : row.type === "removed"
                                ? "bg-rose-400/10"
                                : "bg-transparent"
                        }`}
                      >
                        <pre className="whitespace-pre-wrap border-r border-white/10 p-2 text-slate-200">{row.left || " "}</pre>
                        <pre className="whitespace-pre-wrap p-2 text-slate-100">{row.right || " "}</pre>
                      </div>
                    ))}
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={upgradeApproved}
                      onChange={(event) => setUpgradeApproved(event.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-slate-900"
                    />
                    I reviewed the diff and approve this push.
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <NeonButton onClick={() => void pushUpgrade()} disabled={isPushingUpgrade || !upgradeApproved}>
                      {isPushingUpgrade ? "Pushing..." : "Approve & Push to BD"}
                    </NeonButton>
                    <NeonButton
                      variant="secondary"
                      onClick={() => {
                        setUpgradeState("generated");
                        setUpgradeDiff(null);
                        setUpgradeApprovalToken("");
                        setUpgradeApproved(false);
                      }}
                    >
                      Cancel
                    </NeonButton>
                    <NeonButton variant="secondary" onClick={() => void generateUpgrade()} disabled={isGeneratingUpgrade}>
                      Regenerate
                    </NeonButton>
                  </div>
                </div>
              ) : null}

              <details className="mt-4 rounded-lg border border-white/10 p-3 text-sm text-slate-300">
                <summary className="cursor-pointer text-slate-200">Advanced: Manual Override</summary>
                <div className="mt-2 text-xs text-slate-400">
                  Manual listing text override is intentionally hidden in v1 to keep the upgrade flow simple and deterministic.
                </div>
              </details>
            </section>
          </HudCard>

          <HudCard title="Authority Support" subtitle="Max 4 posts per listing.">
            <div className="grid gap-3 md:grid-cols-2">
              {detail.authority_posts.slice(0, 4).map((post) => (
                <article key={post.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-cyan-100">
                      {post.type}
                    </span>
                    <span className="text-xs text-slate-300">Slot {post.slot}</span>
                  </div>

                  <div className="mb-2 text-[11px] text-slate-300">
                    Step 1: Provide title and focus topic.
                  </div>

                  <input
                    value={titleBySlot[post.slot] ?? post.title ?? ""}
                    onChange={(event) => setTitleBySlot((prev) => ({ ...prev, [post.slot]: event.target.value }))}
                    placeholder="Post title"
                    className="mb-2 w-full rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    value={focusTopicBySlot[post.slot] ?? post.focus_topic ?? ""}
                    onChange={(event) => setFocusTopicBySlot((prev) => ({ ...prev, [post.slot]: event.target.value }))}
                    placeholder="Focus topic"
                    className="mb-3 w-full rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-100"
                  />

                  <div className="mb-3 flex flex-wrap gap-1 text-[11px]">
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-slate-200">Status: {humanPostStatus(post.status)}</span>
                    <span className={`rounded-full border px-2 py-0.5 ${post.blog_to_listing_status === "linked" ? "border-emerald-300/40 text-emerald-100" : "border-amber-300/40 text-amber-100"}`}>
                      Blog→Listing: {humanLinkStatus(post.blog_to_listing_status)}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 ${post.listing_to_blog_status === "linked" ? "border-emerald-300/40 text-emerald-100" : "border-amber-300/40 text-amber-100"}`}>
                      Listing→Blog: {humanLinkStatus(post.listing_to_blog_status)}
                    </span>
                  </div>

                  <div className="mb-2 text-[11px] text-slate-300">
                    Step 2: Generate Draft.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <NeonButton onClick={() => void generateDraft(post.slot)} disabled={busyAction === `draft-${post.slot}`}>
                      {busyAction === `draft-${post.slot}` ? "Generating..." : "Generate Draft"}
                    </NeonButton>
                    <NeonButton variant="secondary" onClick={() => void generateImage(post.slot)} disabled={busyAction === `image-${post.slot}`}>
                      {busyAction === `image-${post.slot}` ? "Generating..." : "Generate Featured Image"}
                    </NeonButton>

                    <NeonButton
                      variant="secondary"
                      onClick={() => void previewBlogPublish(post.slot)}
                      disabled={busyAction === `preview-${post.slot}`}
                    >
                      {busyAction === `preview-${post.slot}` ? "Preparing..." : "Preview"}
                    </NeonButton>

                    {previewAction?.type === "blog_publish" && previewAction.slot === post.slot ? (
                      <NeonButton
                        variant="secondary"
                        onClick={() => void publishBlog(post.slot, previewAction.token)}
                        disabled={busyAction === `publish-${post.slot}`}
                      >
                        {busyAction === `publish-${post.slot}` ? "Publishing..." : "Publish"}
                      </NeonButton>
                    ) : null}
                  </div>

                  <details className="mt-3 rounded-lg border border-white/10 p-2 text-xs text-slate-300">
                    <summary className="cursor-pointer text-cyan-200">Details</summary>
                    <div className="mt-2 space-y-1">
                      <div>Draft status: {humanPostStatus(post.status)}</div>
                      <div>Blog link check: {humanLinkStatus(post.blog_to_listing_status)}</div>
                      <div>Listing link check: {humanLinkStatus(post.listing_to_blog_status)}</div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </HudCard>

          <DiffPreview
            preview={preview}
            approveLabel="Approve & Publish"
            onApprove={async () => {
              if (previewAction?.type === "blog_publish") {
                await publishBlog(previewAction.slot, previewAction.token);
              }
            }}
          />
        </>
      ) : (
        <HudCard title="Loading listing optimization...">
          <div className="h-1" />
        </HudCard>
      )}
    </>
  );
}
