export const dynamic = "force-dynamic";

import { listRecentFileIqJobs, type FileIqJobListRow } from "@/lib/fileiq/fileiq-db";

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className:
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#DCFCE7] text-[#166534]",
  },
  failed: {
    label: "Failed",
    className:
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#FEE2E2] text-[#991B1B]",
  },
  running: {
    label: "Running",
    className:
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#DBEAFE] text-[#1D4ED8]",
  },
  pending: {
    label: "Pending",
    className:
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#F1F5F9] text-[#64748B]",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    className:
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#F1F5F9] text-[#64748B]",
  };
  return <span className={cfg.className}>{cfg.label}</span>;
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function extractedCount(job: FileIqJobListRow): string {
  const n = (job.summary as { totalProductsFound?: unknown }).totalProductsFound;
  return typeof n === "number" ? String(n) : "—";
}

function SchemaBadge({ job }: { job: FileIqJobListRow }) {
  const schemaType = job.summary?.schemaType;
  const schemaVersion = job.summary?.schemaVersion;
  if (schemaType !== "product_catalog") return <span className="text-[#94A3B8]">—</span>;
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#EDE9FE] text-[#5B21B6]">
      Catalog {typeof schemaVersion === "string" ? `v${schemaVersion}` : ""}
    </span>
  );
}

const tableColumns = ["Source Bundle", "Status", "Schema", "Products Extracted", "Brains Notified", "Started"] as const;

export default async function FileIqExtractionJobsPage() {
  let jobs: FileIqJobListRow[] = [];
  try {
    jobs = await listRecentFileIqJobs(50);
  } catch {
    // Table may not be migrated yet; show empty state.
  }

  return (
    <div className="space-y-4" data-testid="fileiq-extraction-jobs">
      <header
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 px-6 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="fileiq-extraction-jobs-header"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-[#64748B]">FileIQ</p>
        <h1 className="mt-1 text-xl font-semibold text-[#0F172A]">Extraction Jobs</h1>
        <p className="mt-1 text-sm text-[#475569]">
          Each ingestion from the Command Center creates an extraction job. The Claude Agent SDK
          processes source files and URLs, extracting structured product facts that are persisted to
          the shared ecommerce database.
        </p>
      </header>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        aria-label="Extraction jobs"
        data-testid="fileiq-extraction-jobs-list"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">All Jobs</h2>
          <span className="text-xs text-[#94A3B8]">
            {jobs.length > 0 ? `${jobs.length} job${jobs.length !== 1 ? "s" : ""}` : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fileiq-extraction-jobs-table">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {tableColumns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B] last:pr-0"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length}
                    className="py-10 text-center text-sm text-[#94A3B8]"
                    data-testid="fileiq-extraction-jobs-empty"
                  >
                    No extraction jobs yet. Submit files or URLs in the Command Center to start.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[#F1F5F9] last:border-0"
                    data-testid="fileiq-extraction-job-row"
                  >
                    <td className="py-3 pr-4 font-medium text-[#0F172A]">{job.bundleName}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <SchemaBadge job={job} />
                    </td>
                    <td className="py-3 pr-4 text-[#334155]">{extractedCount(job)}</td>
                    <td className="py-3 pr-4 text-[#94A3B8]">—</td>
                    <td className="py-3 text-[#64748B]">{formatDate(job.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
