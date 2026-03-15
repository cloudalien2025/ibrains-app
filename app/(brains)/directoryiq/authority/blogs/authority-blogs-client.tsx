"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import HudCard from "@/components/ecomviper/HudCard";
import NeonButton from "@/components/ecomviper/NeonButton";
import AuthoritySectionNav from "@/app/(brains)/directoryiq/authority/_components/authority-section-nav";

type BlogEntity = {
  entityText: string;
  entityType: "listing";
  evidenceSnippet: string | null;
};

type BlogSuggestion = {
  listingExternalId: string;
  listingTitle: string;
  listingUrl: string | null;
  recommendation: string;
};

type MissingLinkRecommendation =
  | string
  | {
      listingExternalId: string;
      listingName: string;
      listingUrl: string | null;
      recommendedAnchorText: string;
      evidenceSnippet: string | null;
    };

type PrimaryType = "Pillar" | "Cluster" | "Comparison" | "Listing Support" | "Mention" | "Proof" | "Needs Review";
type IntentLabel = "Discover" | "Compare" | "Choose" | "Book" | "Trust" | "Plan" | "Local";
type FlywheelStatus = "None" | "Mention Only" | "Connected" | "Reciprocal" | "Selection Asset";
type Confidence = "High" | "Medium" | "Low";
type SelectionValue = "Low" | "Medium" | "High" | "Very High";

type FlywheelStatusByTarget = {
  target_entity_id: string;
  status: FlywheelStatus;
};

type AuthorityBlog = {
  blogNodeId: string;
  blogExternalId: string;
  blogTitle: string | null;
  blogUrl: string | null;
  extractedEntitiesCount: number;
  linkedListingsCount: number;
  unlinkedMentionsCount: number;
  status: "green" | "yellow" | "red";
  entities: BlogEntity[];
  suggestedListingTargets: BlogSuggestion[];
  missingInternalLinksRecommendations: MissingLinkRecommendation[];
  primary_type: PrimaryType;
  intent_labels: IntentLabel[];
  confidence: Confidence;
  parent_pillar_id: string | null;
  dominant_listing_id: string | null;
  target_entity_ids: string[];
  flywheel_status_by_target: FlywheelStatusByTarget[];
  selection_value: SelectionValue;
  classification_reason: string;
  review_candidate: boolean;
};

type SortKey = "selection_value" | "confidence" | "primary_type" | "flywheel_status" | "title";

const PRIMARY_TYPE_FILTERS: Array<PrimaryType> = ["Pillar", "Cluster", "Comparison", "Listing Support", "Mention", "Proof", "Needs Review"];
const INTENT_FILTERS: Array<IntentLabel> = ["Discover", "Compare", "Choose", "Book", "Trust", "Plan", "Local"];
const FLYWHEEL_FILTERS: Array<FlywheelStatus> = ["None", "Mention Only", "Connected", "Reciprocal", "Selection Asset"];
const CONFIDENCE_FILTERS: Array<Confidence> = ["High", "Medium", "Low"];
const SELECTION_FILTERS: Array<SelectionValue> = ["Very High", "High", "Medium", "Low"];

const SELECTION_RANK: Record<SelectionValue, number> = {
  "Very High": 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const PRIMARY_TYPE_RANK: Record<PrimaryType, number> = {
  Comparison: 1,
  "Listing Support": 2,
  Pillar: 3,
  Cluster: 4,
  Proof: 5,
  Mention: 6,
  "Needs Review": 7,
};

const FLYWHEEL_RANK: Record<FlywheelStatus, number> = {
  "Selection Asset": 5,
  Reciprocal: 4,
  Connected: 3,
  "Mention Only": 2,
  None: 1,
};

function statusClass(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
  if (status === "yellow") return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  return "border-rose-300/35 bg-rose-400/10 text-rose-100";
}

function parsePrimaryType(value: unknown): PrimaryType {
  return PRIMARY_TYPE_FILTERS.includes(value as PrimaryType) ? (value as PrimaryType) : "Needs Review";
}

function parseConfidence(value: unknown): Confidence {
  return CONFIDENCE_FILTERS.includes(value as Confidence) ? (value as Confidence) : "Low";
}

function parseSelection(value: unknown): SelectionValue {
  return SELECTION_FILTERS.includes(value as SelectionValue) ? (value as SelectionValue) : "Low";
}

function normalizeBlogRow(raw: Partial<AuthorityBlog>): AuthorityBlog {
  const flywheel = Array.isArray(raw.flywheel_status_by_target)
    ? raw.flywheel_status_by_target.filter(
        (item): item is FlywheelStatusByTarget =>
          !!item && typeof item.target_entity_id === "string" && FLYWHEEL_FILTERS.includes(item.status)
      )
    : [];

  return {
    blogNodeId: raw.blogNodeId ?? "",
    blogExternalId: raw.blogExternalId ?? "",
    blogTitle: raw.blogTitle ?? null,
    blogUrl: raw.blogUrl ?? null,
    extractedEntitiesCount: raw.extractedEntitiesCount ?? 0,
    linkedListingsCount: raw.linkedListingsCount ?? 0,
    unlinkedMentionsCount: raw.unlinkedMentionsCount ?? 0,
    status: raw.status ?? "red",
    entities: raw.entities ?? [],
    suggestedListingTargets: raw.suggestedListingTargets ?? [],
    missingInternalLinksRecommendations: raw.missingInternalLinksRecommendations ?? [],
    primary_type: parsePrimaryType(raw.primary_type),
    intent_labels: Array.isArray(raw.intent_labels)
      ? raw.intent_labels.filter((label): label is IntentLabel => INTENT_FILTERS.includes(label as IntentLabel))
      : [],
    confidence: parseConfidence(raw.confidence),
    parent_pillar_id: raw.parent_pillar_id ?? null,
    dominant_listing_id: raw.dominant_listing_id ?? null,
    target_entity_ids: Array.isArray(raw.target_entity_ids)
      ? raw.target_entity_ids.filter((id): id is string => typeof id === "string")
      : [],
    flywheel_status_by_target: flywheel,
    selection_value: parseSelection(raw.selection_value),
    classification_reason: raw.classification_reason ?? "Assigned Needs Review due to unavailable classification signals.",
    review_candidate:
      typeof raw.review_candidate === "boolean" ? raw.review_candidate : parsePrimaryType(raw.primary_type) === "Needs Review" || parseConfidence(raw.confidence) === "Low",
  };
}

export default function AuthorityBlogsClient() {
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams.get("blog");

  const [rows, setRows] = useState<AuthorityBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuthorityBlog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [primaryTypeFilter, setPrimaryTypeFilter] = useState<"all" | PrimaryType>("all");
  const [intentFilter, setIntentFilter] = useState<"all" | IntentLabel>("all");
  const [flywheelFilter, setFlywheelFilter] = useState<"all" | FlywheelStatus>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | Confidence>("all");
  const [selectionFilter, setSelectionFilter] = useState<"all" | SelectionValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("selection_value");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/directoryiq/authority/blogs", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        blogs?: Partial<AuthorityBlog>[];
        error?: { message?: string };
      };
      if (!response.ok || json.ok === false) {
        setError(json.error?.message ?? "Failed to load authority blogs.");
        setLoading(false);
        return;
      }

      const data = (json.blogs ?? []).map((row) => normalizeBlogRow(row));
      setRows(data);
      setLoading(false);
      if (selectedFromQuery) {
        const match = data.find((row) => row.blogExternalId === selectedFromQuery);
        if (match) setSelected(match);
      }
    } catch {
      setError("Failed to load authority blogs.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  const reviewCandidates = useMemo(() => rows.filter((row) => row.review_candidate), [rows]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (primaryTypeFilter !== "all" && row.primary_type !== primaryTypeFilter) return false;
      if (intentFilter !== "all" && !row.intent_labels.includes(intentFilter)) return false;
      if (flywheelFilter !== "all" && !row.flywheel_status_by_target.some((item) => item.status === flywheelFilter)) return false;
      if (confidenceFilter !== "all" && row.confidence !== confidenceFilter) return false;
      if (selectionFilter !== "all" && row.selection_value !== selectionFilter) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortKey === "selection_value") {
        return SELECTION_RANK[b.selection_value] - SELECTION_RANK[a.selection_value] || a.blogExternalId.localeCompare(b.blogExternalId);
      }
      if (sortKey === "confidence") {
        return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] || a.blogExternalId.localeCompare(b.blogExternalId);
      }
      if (sortKey === "primary_type") {
        return PRIMARY_TYPE_RANK[a.primary_type] - PRIMARY_TYPE_RANK[b.primary_type] || a.blogExternalId.localeCompare(b.blogExternalId);
      }
      if (sortKey === "flywheel_status") {
        const aRank = Math.max(...a.flywheel_status_by_target.map((item) => FLYWHEEL_RANK[item.status]), 0);
        const bRank = Math.max(...b.flywheel_status_by_target.map((item) => FLYWHEEL_RANK[item.status]), 0);
        return bRank - aRank || a.blogExternalId.localeCompare(b.blogExternalId);
      }
      return (a.blogTitle ?? a.blogExternalId).localeCompare(b.blogTitle ?? b.blogExternalId);
    });
  }, [rows, primaryTypeFilter, intentFilter, flywheelFilter, confidenceFilter, selectionFilter, sortKey]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <h1 className="text-xl font-semibold text-slate-100">Blog Content Layer</h1>
        <p className="mt-1 text-sm text-slate-300">Deterministic post classification for selection-oriented authority signals.</p>
      </section>

      <AuthoritySectionNav />

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      {!loading && rows.length > 0 ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Review Candidates</div>
          <div className="mt-1 text-sm text-slate-200">
            {reviewCandidates.length} post{reviewCandidates.length === 1 ? "" : "s"} require review (Low confidence or Needs Review).
          </div>
        </section>
      ) : null}

      <HudCard title="Blog Posts" subtitle="Classification is deterministic and persisted from current content/link/entity signals.">
        {loading ? <div className="text-sm text-slate-300">Loading blog layer...</div> : null}
        {empty ? <div className="text-sm text-slate-300">No blog nodes found yet. Run Blog Ingestion from Overview.</div> : null}

        {!loading && rows.length > 0 ? (
          <>
            <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <label className="text-xs text-slate-300">
                Primary Type
                <select
                  data-testid="authority-blog-filter-primary-type"
                  value={primaryTypeFilter}
                  onChange={(event) => setPrimaryTypeFilter(event.target.value as "all" | PrimaryType)}
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="all">All</option>
                  {PRIMARY_TYPE_FILTERS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Intent
                <select
                  data-testid="authority-blog-filter-intent"
                  value={intentFilter}
                  onChange={(event) => setIntentFilter(event.target.value as "all" | IntentLabel)}
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="all">All</option>
                  {INTENT_FILTERS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Flywheel
                <select
                  data-testid="authority-blog-filter-flywheel"
                  value={flywheelFilter}
                  onChange={(event) => setFlywheelFilter(event.target.value as "all" | FlywheelStatus)}
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="all">All</option>
                  {FLYWHEEL_FILTERS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Confidence
                <select
                  data-testid="authority-blog-filter-confidence"
                  value={confidenceFilter}
                  onChange={(event) => setConfidenceFilter(event.target.value as "all" | Confidence)}
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="all">All</option>
                  {CONFIDENCE_FILTERS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Selection Value
                <select
                  data-testid="authority-blog-filter-selection"
                  value={selectionFilter}
                  onChange={(event) => setSelectionFilter(event.target.value as "all" | SelectionValue)}
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="all">All</option>
                  {SELECTION_FILTERS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Sort
                <select
                  data-testid="authority-blog-sort"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="mt-1 w-full rounded border border-white/20 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="selection_value">Selection Value (desc)</option>
                  <option value="confidence">Confidence (desc)</option>
                  <option value="primary_type">Primary Type (precedence)</option>
                  <option value="flywheel_status">Flywheel Status (desc)</option>
                  <option value="title">Title (A-Z)</option>
                </select>
              </label>
            </div>

            <div data-testid="authority-blog-mobile-list" className="space-y-3 md:hidden">
              {filteredRows.map((row) => (
                <article
                  key={row.blogNodeId}
                  data-testid={`authority-blog-mobile-card-${row.blogExternalId}`}
                  className="min-w-0 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="min-w-0 flex-1 text-left text-cyan-100 underline-offset-2 hover:underline"
                    >
                      <span className="block break-words">{row.blogTitle ?? row.blogExternalId}</span>
                    </button>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${statusClass(row.status)}`}>
                      {row.status.toUpperCase()}
                    </span>
                  </div>

                  {row.review_candidate ? (
                    <div
                      data-testid="authority-blog-review-pill"
                      className="mt-2 inline-flex max-w-full rounded border border-amber-300/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-amber-100"
                    >
                      Review Candidate
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs text-slate-500 break-all">{row.blogUrl ?? "-"}</div>

                  <div
                    data-testid="authority-blog-mobile-classification"
                    className="mt-3 flex min-w-0 flex-wrap gap-1.5 text-[11px] text-slate-200"
                  >
                    <span className="rounded border border-white/20 bg-white/[0.04] px-2 py-0.5 break-words">Type: {row.primary_type}</span>
                    <span className="rounded border border-white/20 bg-white/[0.04] px-2 py-0.5">Confidence: {row.confidence}</span>
                    <span className="rounded border border-white/20 bg-white/[0.04] px-2 py-0.5">Selection: {row.selection_value}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Blog Title</th>
                    <th className="py-2 pr-3">Primary Type</th>
                    <th className="py-2 pr-3">Intent Labels</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Selection Value</th>
                    <th className="py-2 pr-3">Dominant / Targets</th>
                    <th className="py-2 pr-3">Parent Pillar</th>
                    <th className="py-2 pr-3">Flywheel</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.blogNodeId} data-testid={`authority-blog-row-${row.blogExternalId}`} className="border-t border-white/10">
                      <td className="py-2 pr-3">
                        <button type="button" onClick={() => setSelected(row)} className="text-left text-cyan-100 underline-offset-2 hover:underline">
                          {row.blogTitle ?? row.blogExternalId}
                        </button>
                        {row.review_candidate ? (
                          <div data-testid="authority-blog-review-pill" className="mt-1 inline-flex rounded border border-amber-300/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-amber-100">
                            Review Candidate
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">{row.blogUrl ?? "-"}</div>
                      </td>
                      <td className="py-2 pr-3">{row.primary_type}</td>
                      <td className="py-2 pr-3">{row.intent_labels.length ? row.intent_labels.join(", ") : "-"}</td>
                      <td className="py-2 pr-3">{row.confidence}</td>
                      <td className="py-2 pr-3">{row.selection_value}</td>
                      <td className="py-2 pr-3">
                        <div className="text-slate-200">{row.dominant_listing_id ?? "-"}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.target_entity_ids.length ? row.target_entity_ids.join(", ") : "-"}</div>
                      </td>
                      <td className="py-2 pr-3">{row.parent_pillar_id ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {row.flywheel_status_by_target.length
                          ? row.flywheel_status_by_target.map((item) => `${item.target_entity_id}: ${item.status}`).join("; ")
                          : "-"}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </HudCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65">
          <div className="flex h-full w-full max-w-[min(94vw,560px)] flex-col border-l border-white/10 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-100">{selected.blogTitle ?? selected.blogExternalId}</h3>
              <NeonButton variant="ghost" onClick={() => setSelected(null)}>Close</NeonButton>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1 text-sm text-slate-200">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Classification</div>
                <div className="mt-2 space-y-1">
                  <div>Primary Type: <span className="text-slate-100">{selected.primary_type}</span></div>
                  <div>Intent Labels: <span className="text-slate-100">{selected.intent_labels.length ? selected.intent_labels.join(", ") : "-"}</span></div>
                  <div>Confidence: <span className="text-slate-100">{selected.confidence}</span></div>
                  <div>Selection Value: <span className="text-slate-100">{selected.selection_value}</span></div>
                  <div>Dominant Listing: <span className="text-slate-100">{selected.dominant_listing_id ?? "-"}</span></div>
                  <div>Parent Pillar: <span className="text-slate-100">{selected.parent_pillar_id ?? "-"}</span></div>
                  <div>Targets: <span className="text-slate-100">{selected.target_entity_ids.length ? selected.target_entity_ids.join(", ") : "-"}</span></div>
                  <div>Classification Reason: <span className="text-slate-100">{selected.classification_reason}</span></div>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Flywheel Status by Target</div>
                <div className="mt-2 space-y-2">
                  {selected.flywheel_status_by_target.length === 0 ? <div className="text-slate-400">No target relationships.</div> : null}
                  {selected.flywheel_status_by_target.map((item) => (
                    <div key={`${item.target_entity_id}-${item.status}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{item.target_entity_id}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.status}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Entities ({selected.entities.length})</div>
                <div className="mt-2 space-y-2">
                  {selected.entities.length === 0 ? <div className="text-slate-400">No entities detected.</div> : null}
                  {selected.entities.map((entity, index) => (
                    <div key={`${entity.entityText}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{entity.entityText}</div>
                      <div className="mt-1 text-xs text-slate-400">{entity.evidenceSnippet ?? "No snippet"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Suggested Listing Targets</div>
                <div className="mt-2 space-y-2">
                  {selected.suggestedListingTargets.length === 0 ? <div className="text-slate-400">No suggestions.</div> : null}
                  {selected.suggestedListingTargets.map((target) => (
                    <div key={`${target.listingExternalId}-${target.recommendation}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div>{target.listingTitle}</div>
                      <div className="mt-1 text-xs text-slate-400">{target.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Missing Internal Links Recommendations</div>
                <div className="mt-2 space-y-2">
                  {selected.missingInternalLinksRecommendations.length === 0 ? <div className="text-slate-400">No missing link recommendations.</div> : null}
                  {selected.missingInternalLinksRecommendations.map((recommendation, index) => {
                    if (typeof recommendation === "string") {
                      return (
                        <div key={`${recommendation}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                          {recommendation}
                        </div>
                      );
                    }
                    return (
                      <div key={`${recommendation.listingExternalId}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                        <div>{recommendation.listingName}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          Link to {recommendation.listingUrl ?? "listing URL unavailable"} using anchor &quot;{recommendation.recommendedAnchorText}&quot;.
                        </div>
                        {recommendation.evidenceSnippet ? (
                          <div className="mt-1 text-xs text-slate-500">{recommendation.evidenceSnippet}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
