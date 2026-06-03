const recentJobColumns = ["Source / File", "Status", "Extracted", "Brains Notified", "Submitted"] as const;

export default function FileIqWorkspaceShell() {
  return (
    <div className="space-y-4" data-testid="fileiq-workspace-shell">
      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
        data-testid="fileiq-page-header"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">FileIQ</p>
        <h1 className="mt-1 text-xl font-semibold text-[#0F172A]">Command Center</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#475569]">
          Ingest supplier source files to extract canonical product facts for your commerce brains.
        </p>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
        data-testid="fileiq-ingest-input"
        aria-label="Ingest a file or URL"
      >
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#BFDBFE] bg-[#EFF6FF] px-6 py-10 text-center"
          data-testid="fileiq-drop-zone"
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#BFDBFE] bg-white/80 text-[#1D4ED8]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Drop a file or paste a URL to ingest</p>
            <p className="mt-1 text-xs text-[#475569]">PDF, DOCX, XLSX, HTML, PNG, JPG, .ai, .tif</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="url"
            placeholder="Paste a URL to ingest…"
            disabled
            aria-label="URL to ingest"
            className="min-w-0 flex-1 rounded-lg border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-sm text-[#334155] placeholder:text-[#94A3B8] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            disabled
            className="rounded-lg border border-[#D9E4F0] bg-[#F1F5F9] px-4 py-2 text-sm font-medium text-[#94A3B8] disabled:cursor-not-allowed"
          >
            Ingest
          </button>
        </div>
        <p className="mt-2 text-xs text-[#94A3B8]">Ingestion is not yet active. Live extraction wires in Phase 1.2.</p>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
        data-testid="fileiq-recent-jobs"
        aria-label="Recent ingestion jobs"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">Recent Ingestion Jobs</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fileiq-jobs-table">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {recentJobColumns.map((col) => (
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
              <tr>
                <td
                  colSpan={recentJobColumns.length}
                  className="py-10 text-center text-sm text-[#94A3B8]"
                  data-testid="fileiq-jobs-empty"
                >
                  No ingestion jobs yet. Drop a file or paste a URL above to get started.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
