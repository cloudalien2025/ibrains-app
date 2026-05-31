import Link from "next/link";
import AdminStatusBadge from "@/app/admin/_components/admin-status-badge";
import { getRocktomicAdminAuditViewModel, type RocktomicCoverageRow } from "@/lib/ecomviper/suppliers/rocktomic-admin-audit";
import { safeIsoDate } from "@/lib/ui/safe-formatters";

function coverageTableRows(rows: RocktomicCoverageRow[]) {
  return rows.slice(0, 16);
}

function defectPreview(values: string[]): string {
  if (values.length === 0) return "-";
  const top = values.slice(0, 2).join("; ");
  if (values.length <= 2) return top;
  return `${top}; +${values.length - 2} more`;
}

function boolMark(value: boolean): string {
  return value ? "yes" : "no";
}

export default async function RocktomicAuditPage() {
  const audit = await getRocktomicAdminAuditViewModel();

  return (
    <section className="space-y-4" data-testid="admin-rocktomic-audit-page">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin / EcomViper / Rocktomic / Audit</p>
        <h2 className="mt-1 text-2xl font-semibold">Rocktomic Supplier Audit</h2>
        <p className="mt-2 text-sm text-slate-600">Offline package visibility only. This page does not fetch sources, run extraction, run validation, or import data.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Package status</span>
          <AdminStatusBadge status={audit.packageStatus} />
          <span className="text-sm text-slate-600">Generated</span>
          <span className="text-sm font-medium text-slate-800">{safeIsoDate(audit.packageGeneratedAt, "Unknown")}</span>
          <span className="text-sm text-slate-600">Policy</span>
          <span className="text-sm font-medium text-slate-800">{audit.validationPolicyVersion || "Unknown"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/ecomviper/suppliers/rocktomic" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Back to Supplier Summary
          </Link>
          <Link href="/admin/ecomviper/suppliers/rocktomic/builds" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            Build History
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-9" data-testid="admin-rocktomic-audit-summary-cards">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total SKUs Discovered</p><p className="mt-2 text-lg font-semibold">{audit.totalSkusDiscovered}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total SKUs Validated</p><p className="mt-2 text-lg font-semibold">{audit.totalSkusValidated}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Usable</p><p className="mt-2 text-lg font-semibold">{audit.usableSkuCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Usable With Warnings</p><p className="mt-2 text-lg font-semibold">{audit.usableWithWarningsSkuCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Blocked</p><p className="mt-2 text-lg font-semibold">{audit.blockedSkuCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Extraction Errors</p><p className="mt-2 text-lg font-semibold">{audit.extractionErrorSkuCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">OCR Needs Review</p><p className="mt-2 text-lg font-semibold">{audit.ocrNeedsReviewSkuCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">OptiPixel Ready</p><p className="mt-2 text-lg font-semibold">{audit.usableForOptiPixelSkuCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Channel Image Ready</p><p className="mt-2 text-lg font-semibold">{audit.readyForChannelImageGenerationSkuCount}</p></article>
      </div>

      {audit.issues.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">Package Issues</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {audit.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Source Registry</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">URL</th>
                <th className="py-2 pr-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {audit.sourceRegistrySummary.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top text-slate-700">
                  <td className="py-2 pr-3">{row.name}</td>
                  <td className="py-2 pr-3">{row.type}</td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.status} /></td>
                  <td className="py-2 pr-3" title={row.urlPreview}>{row.urlLabel}</td>
                  <td className="py-2 pr-3">{row.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Field Coverage</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 pr-3">Field</th>
                  <th className="py-2 pr-3">Present</th>
                  <th className="py-2 pr-3">Missing</th>
                  <th className="py-2 pr-3">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {coverageTableRows(audit.fieldCoverageSummary).map((row) => (
                  <tr key={row.field} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="py-2 pr-3">{row.field}</td>
                    <td className="py-2 pr-3">{row.presentSkuCount}/{row.requiredSkuCount}</td>
                    <td className="py-2 pr-3">{row.missingSkuCount}</td>
                    <td className="py-2 pr-3">{row.coveragePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Blocking Coverage</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 pr-3">Field</th>
                  <th className="py-2 pr-3">Present</th>
                  <th className="py-2 pr-3">Missing</th>
                  <th className="py-2 pr-3">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {coverageTableRows(audit.blockingFieldCoverageSummary).map((row) => (
                  <tr key={row.field} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="py-2 pr-3">{row.field}</td>
                    <td className="py-2 pr-3">{row.presentSkuCount}/{row.requiredSkuCount}</td>
                    <td className="py-2 pr-3">{row.missingSkuCount}</td>
                    <td className="py-2 pr-3">{row.coveragePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Warning Coverage</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 pr-3">Field</th>
                  <th className="py-2 pr-3">Present</th>
                  <th className="py-2 pr-3">Missing</th>
                  <th className="py-2 pr-3">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {coverageTableRows(audit.warningFieldCoverageSummary).map((row) => (
                  <tr key={row.field} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="py-2 pr-3">{row.field}</td>
                    <td className="py-2 pr-3">{row.presentSkuCount}/{row.requiredSkuCount}</td>
                    <td className="py-2 pr-3">{row.missingSkuCount}</td>
                    <td className="py-2 pr-3">{row.coveragePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Defect Summary</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-medium">Package Defects</p>
              {audit.packageDefects.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {audit.packageDefects.slice(0, 8).map((defect) => (
                    <li key={defect}>{defect}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">No package-level defects.</p>
              )}
            </div>
            <div>
              <p className="font-medium">Source Errors</p>
              {audit.sourceErrors.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {audit.sourceErrors.slice(0, 8).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">No source errors reported.</p>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Top SKU Defects</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Blocking</th>
                  <th className="py-2 pr-3">Warning</th>
                  <th className="py-2 pr-3">Missing</th>
                </tr>
              </thead>
              <tbody>
                {audit.topSkuDefects.map((row) => (
                  <tr key={row.sku} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="py-2 pr-3">{row.sku}</td>
                    <td className="py-2 pr-3"><AdminStatusBadge status={row.status} /></td>
                    <td className="py-2 pr-3">{row.blockingDefectCount}</td>
                    <td className="py-2 pr-3">{row.warningDefectCount}</td>
                    <td className="py-2 pr-3">{defectPreview(row.missingFields)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">SKU Validation Table</h3>
          <p className="text-sm text-slate-600">Showing {audit.skuValidationPreview.length} of {audit.totalSkuValidationResults} SKUs</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm" data-testid="admin-rocktomic-audit-table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Product Name</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Validation Status</th>
                <th className="py-2 pr-3">Blocking Defects</th>
                <th className="py-2 pr-3">Warning Defects</th>
                <th className="py-2 pr-3">Readiness Flags</th>
                <th className="py-2 pr-3">Missing Fields</th>
                <th className="py-2 pr-3">Source Notes</th>
              </tr>
            </thead>
            <tbody>
              {audit.skuValidationPreview.map((row) => (
                <tr key={row.sku} className="border-b border-slate-100 align-top text-slate-700" data-testid="admin-rocktomic-audit-row">
                  <td className="py-2 pr-3 font-medium">{row.sku}</td>
                  <td className="py-2 pr-3">{row.productName || "-"}</td>
                  <td className="py-2 pr-3">{row.skuType || "unknown"}</td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={row.status} /></td>
                  <td className="py-2 pr-3">{row.blockingDefectCount}</td>
                  <td className="py-2 pr-3">{row.warningDefectCount}</td>
                  <td className="py-2 pr-3">
                    PE:{boolMark(row.readiness.usableForProductEditor)} | GI:{boolMark(row.readiness.usableForGenerateIntelligence)} | IS:{boolMark(row.readiness.usableForImageStudio)} | OP:{boolMark(row.readiness.usableForOptiPixel)} | OB:{boolMark(row.readiness.usableForOptiBay)} | OW:{boolMark(row.readiness.usableForOptiWal)} | OZ:{boolMark(row.readiness.usableForOptizon)} | CIG:{boolMark(row.readiness.readyForChannelImageGeneration)}
                  </td>
                  <td className="py-2 pr-3">{defectPreview(row.missingFields)}</td>
                  <td className="py-2 pr-3">{defectPreview(row.sourceNotes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Artifact Status</h3>
        <p className="mt-2 text-sm text-slate-600">`audit.csv` rows detected: {audit.auditCsvRowCount}. Download endpoints are deferred to a future phase.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">Artifact</th>
                <th className="py-2 pr-3">Path</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {audit.artifactStatuses.map((artifact) => (
                <tr key={artifact.artifact} className="border-b border-slate-100 align-top text-slate-700">
                  <td className="py-2 pr-3">{artifact.artifact}</td>
                  <td className="py-2 pr-3">{artifact.relativePath}</td>
                  <td className="py-2 pr-3"><AdminStatusBadge status={artifact.exists ? "present" : "missing"} /></td>
                  <td className="py-2 pr-3">{artifact.sizeBytes ?? "-"}</td>
                  <td className="py-2 pr-3">{safeIsoDate(artifact.lastModifiedAt, "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
