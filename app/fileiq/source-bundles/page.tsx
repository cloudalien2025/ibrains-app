export const dynamic = "force-dynamic";

const supportedFileTypes = [
  { type: "PDF", note: "Catalogs, spec sheets, COAs" },
  { type: "DOCX", note: "Policies, descriptions" },
  { type: "XLSX", note: "Pricing, inventory, catalogs" },
  { type: "HTML", note: "Templates, source pages" },
  { type: "PNG / JPG", note: "Label and panel scans" },
  { type: ".ai", note: "Label artwork" },
  { type: ".tif", note: "High-resolution label scans" },
] as const;

export default function FileIqSourceBundlesPage() {
  return (
    <div className="space-y-4" data-testid="fileiq-source-bundles">
      <header
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 px-6 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="fileiq-source-bundles-header"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-[#64748B]">FileIQ</p>
        <h1 className="mt-1 text-xl font-semibold text-[#0F172A]">Source Bundles</h1>
        <p className="mt-1 text-sm text-[#475569]">
          A source bundle groups a supplier&apos;s files into a single tracked unit for ingestion.
          Each bundle is registered here, then extraction jobs process its files through the
          provenance-tracked pipeline.
        </p>
      </header>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        aria-label="Registered source bundles"
        data-testid="fileiq-source-bundles-list"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">Registered Bundles</h2>
        </div>

        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#D9E4F0] bg-[#F8FBFF] py-12 text-center"
          data-testid="fileiq-source-bundles-empty-state"
        >
          <p className="text-sm font-medium text-[#334155]">No source bundles registered</p>
          <p className="max-w-sm text-xs text-[#64748B]">
            Bundle registration and file upload wire in Phase 1.2 when extraction jobs land.
            The{" "}
            <code className="rounded bg-[#F1F5F9] px-1 py-0.5 text-[#0F172A]">
              fileiq_source_bundles
            </code>{" "}
            and{" "}
            <code className="rounded bg-[#F1F5F9] px-1 py-0.5 text-[#0F172A]">
              fileiq_source_files
            </code>{" "}
            tables are live and ready for writes.
          </p>
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="fileiq-source-bundles-file-types"
      >
        <h2 className="text-base font-semibold text-[#0F172A]">Supported File Types</h2>
        <p className="mt-1 text-sm text-[#475569]">
          A bundle can contain any mix of the following source file formats. Each registered file
          carries a content hash for dedupe — duplicate files within a bundle are rejected at
          registration time.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {supportedFileTypes.map(({ type, note }) => (
            <li
              key={type}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2"
            >
              <p className="text-sm font-medium text-[#0F172A]">{type}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">{note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
