"use client";

import { useMemo, useState } from "react";
import { buildEbayListingAuditRows, importEbayListingsForPhase1 } from "@/lib/ecomviper/ebay/dashboard";
import type { EbayDashboardConnectionSummary, EbayListingAuditRow } from "@/lib/ecomviper/ebay/types";

interface EbayDashboardClientProps {
  connection: EbayDashboardConnectionSummary;
}

function connectionStateLabel(state: EbayDashboardConnectionSummary["connectionState"]): string {
  if (state === "mock_mode") return "Mock mode";
  if (state === "ready_for_credentials") return "Ready for credentials";
  return "Not connected";
}

function environmentLabel(environment: EbayDashboardConnectionSummary["environment"]): string {
  if (environment === "sandbox") return "Sandbox";
  return "Production placeholder";
}

function priorityClass(priority: EbayListingAuditRow["score"]["priority"]): string {
  if (priority === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function checklistItemClass(configured: boolean): string {
  return configured
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

export default function EbayDashboardClient({ connection }: EbayDashboardClientProps) {
  const [auditRows, setAuditRows] = useState<EbayListingAuditRow[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importMode, setImportMode] = useState(connection.mode);
  const [isImporting, setIsImporting] = useState(false);

  const selectedRow = useMemo(() => {
    if (!auditRows.length) return null;
    if (!selectedSku) return auditRows[0];
    return auditRows.find((row) => row.listing.sku === selectedSku) ?? auditRows[0];
  }, [auditRows, selectedSku]);

  async function handleImportListings(): Promise<void> {
    setIsImporting(true);
    try {
      const imported = await importEbayListingsForPhase1(connection);
      const rows = await buildEbayListingAuditRows(imported.listings, connection);
      setAuditRows(rows);
      setSelectedSku(rows[0]?.listing.sku ?? null);
      setImportWarnings(imported.warnings);
      setImportMode(imported.mode);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-6 py-8" data-testid="ecomviper-ebay-dashboard">
      <header className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full border border-[#D9E4F0] bg-[#EFF4F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#475569]">
              eBay Marketplace
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A]">Phase 1 Listing Optimization Dashboard</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#475569]">
              Mock-first and read-only eBay listing optimization workspace. This phase audits listings and recommendations only.
            </p>
          </div>
          <div className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs font-medium text-[#334155]">
            Environment: {environmentLabel(connection.environment)}
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]" data-testid="ecomviper-ebay-connection-panel">
          <h2 className="text-lg font-semibold text-[#0F172A]">eBay Connection Panel</h2>
          <p className="mt-2 text-sm text-[#475569]">Connection state: {connectionStateLabel(connection.connectionState)}</p>
          <p className="mt-1 text-xs text-[#64748B]">Scope for future read-only inventory import: {connection.readOnlyScope}</p>
          <p className="mt-2 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#334155]">{connection.readOnlyBoundaryNote}</p>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">BYO credentials checklist</p>
            <ul className="grid gap-2">
              {connection.checklist.map((item) => (
                <li key={item.key} className={`rounded-lg border px-3 py-2 text-sm ${checklistItemClass(item.configured)}`}>
                  {item.label}: {item.configured ? "Configured" : "Missing"}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              className="rounded-lg border border-[#CBD5E1] bg-[#F1F5F9] px-3 py-2 text-sm text-[#64748B]"
              title="OAuth connect will be enabled in a future phase"
            >
              Connect eBay (placeholder)
            </button>
            <span className="text-xs text-[#64748B]">OAuth is intentionally not enabled in Phase 1.</span>
          </div>
        </article>

        <article className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]" data-testid="ecomviper-ebay-import-panel">
          <h2 className="text-lg font-semibold text-[#0F172A]">Listing Import Panel</h2>
          <p className="mt-2 text-sm text-[#475569]">
            Import action loads deterministic mock eBay listings in mock mode. Live Inventory API seam is wired but guarded in this phase.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void handleImportListings();
              }}
              disabled={isImporting}
              className="rounded-lg border border-[#2563EB] bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="ecomviper-ebay-import-button"
            >
              {isImporting ? "Importing..." : "Import eBay Listings"}
            </button>
            <span className="rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-2.5 py-1 text-xs text-[#334155]">Mode: {importMode}</span>
            <span className="text-xs text-[#64748B]">Imported listings: {auditRows.length}</span>
          </div>

          {importWarnings.length ? (
            <ul className="mt-3 space-y-1 text-xs text-[#64748B]" data-testid="ecomviper-ebay-import-warnings">
              {importWarnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[#64748B]">No imports yet.</p>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]" data-testid="ecomviper-ebay-audit-table">
        <h2 className="text-lg font-semibold text-[#0F172A]">Listing Audit Table</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="px-2 py-2">SKU</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Condition</th>
                <th className="px-2 py-2">Quantity</th>
                <th className="px-2 py-2">Image count</th>
                <th className="px-2 py-2">Aspect score</th>
                <th className="px-2 py-2">Title score</th>
                <th className="px-2 py-2">Description score</th>
                <th className="px-2 py-2">Overall score</th>
                <th className="px-2 py-2">Status / priority</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.length ? (
                auditRows.map((row) => {
                  const active = selectedRow?.listing.sku === row.listing.sku;
                  return (
                    <tr key={row.listing.id} className={`border-t border-[#E2E8F0] ${active ? "bg-[#F8FBFF]" : "bg-white"}`}>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-left font-medium text-[#1D4ED8] hover:text-[#1E40AF]"
                          onClick={() => setSelectedSku(row.listing.sku)}
                        >
                          {row.listing.sku}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-[#334155]">{row.listing.title}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.listing.categoryName}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.listing.condition}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.listing.quantity}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.listing.imageUrls.length}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.score.aspectScore}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.score.titleScore}</td>
                      <td className="px-2 py-2 text-[#334155]">{row.score.descriptionScore}</td>
                      <td className="px-2 py-2 font-semibold text-[#0F172A]">{row.score.overallScore}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClass(row.score.priority)}`}>
                          {row.score.status} / {row.score.priority}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-[#E2E8F0]">
                  <td colSpan={11} className="px-2 py-8 text-center text-sm text-[#64748B]">
                    Import eBay listings to start scoring and optimization analysis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]" data-testid="ecomviper-ebay-optimization-panel">
        <h2 className="text-lg font-semibold text-[#0F172A]">Listing Detail / Optimization Panel</h2>
        {!selectedRow ? (
          <p className="mt-3 text-sm text-[#64748B]">Select a listing after import to review optimization recommendations.</p>
        ) : (
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            <article className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Current title</p>
                <p className="mt-1 text-sm text-[#334155]">{selectedRow.listing.title}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Suggested optimized title</p>
                <p className="mt-1 text-sm text-[#0F172A]">{selectedRow.recommendation.suggestedTitle}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Current description summary</p>
                <p className="mt-1 text-sm text-[#334155]">{selectedRow.listing.descriptionSummary}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Suggested description direction</p>
                <p className="mt-1 text-sm text-[#334155]">{selectedRow.recommendation.suggestedDescriptionDirection}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Priority explanation</p>
                <p className="mt-1 text-sm text-[#334155]">{selectedRow.recommendation.priorityExplanation}</p>
              </div>
            </article>

            <article className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Missing required aspects</p>
                <p className="mt-1 text-sm text-[#334155]">
                  {selectedRow.recommendation.missingRequiredAspects.join(", ") || "None"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Missing recommended aspects</p>
                <p className="mt-1 text-sm text-[#334155]">
                  {selectedRow.recommendation.missingRecommendedAspects.join(", ") || "None"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Identifier issues</p>
                <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                  {selectedRow.recommendation.identifierIssues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Image recommendations</p>
                <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                  {selectedRow.recommendation.imageImprovementNotes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">Compliance-safe rewrite notes</p>
                <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                  {selectedRow.recommendation.complianceSafeRewriteNotes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="space-y-2 rounded-xl border border-[#E2E8F0] bg-white p-4 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">AI-ready recommendation output</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">Search visibility notes</p>
                  <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                    {selectedRow.recommendation.searchVisibilityNotes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">Conversion improvement notes</p>
                  <ul className="mt-1 space-y-1 text-sm text-[#334155]">
                    {selectedRow.recommendation.conversionImprovementNotes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
