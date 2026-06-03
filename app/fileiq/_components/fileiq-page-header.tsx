export default function FileIqPageHeader() {
  return (
    <section
      className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
      data-testid="fileiq-page-header"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">FileIQ</p>
          <h1 className="text-xl font-semibold text-[#0F172A]">Command Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#475569]">
            Internal source-file-to-facts workspace for shared ecommerce data contracts. FileIQ owns extraction provenance,
            validation state, and review lifecycle; downstream brains read approved canonical facts.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-[#D9E4F0] bg-[#F8FBFF] px-3 py-1 text-xs text-[#475569]">
          Internal only
        </span>
      </div>
    </section>
  );
}
