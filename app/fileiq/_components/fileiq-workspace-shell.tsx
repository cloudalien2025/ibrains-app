import FileIqPageHeader from "@/app/fileiq/_components/fileiq-page-header";
import FileIqDashboardCards from "@/app/fileiq/_components/fileiq-dashboard-cards";
import { fileIqDownstreamBrains } from "@/lib/fileiq/fileiq-status";
import { fileIqPlannedTables } from "@/lib/fileiq/fileiq-schema";

const ingestionStages = [
  {
    title: "Source Bundles",
    detail: "Suppliers register file bundles (PDF, DOCX, XLSX, HTML, images, .ai, .tif).",
  },
  {
    title: "Extraction Jobs",
    detail: "Each job runs as a Claude Agent SDK session; the agent session id is tracked for monitoring and retry.",
  },
  {
    title: "Canonical Facts",
    detail: "Structured product facts and assets are normalized with field-level provenance.",
  },
  {
    title: "Validation & Review",
    detail: "Validation reports and a human review queue gate which facts become approved.",
  },
  {
    title: "Brain Outputs",
    detail: "Approved canonical packages are published for downstream commerce brains to read.",
  },
] as const;

const agentCapabilities = [
  { label: "File reading", note: "Read supplier source files" },
  { label: "Web fetch", note: "Resolve linked source evidence" },
  { label: "Bash", note: "Run extraction tooling" },
  { label: "Vision", note: "Read image-based labels/panels" },
] as const;

const downstreamBrainLabels: Record<(typeof fileIqDownstreamBrains)[number], string> = {
  ecomviper: "EcomViper",
  optibay: "OptiBay",
  optiwal: "OptiWal",
  optipixel: "OptiPixel",
  optizon: "OptiZon",
};

export default function FileIqWorkspaceShell() {
  return (
    <div className="space-y-4" data-testid="fileiq-workspace-shell">
      <FileIqPageHeader />
      <FileIqDashboardCards />

      <section
        className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
        data-testid="fileiq-pipeline-panel"
      >
        <h2 className="text-lg font-semibold text-[#0F172A]">Ingestion Pipeline</h2>
        <p className="mt-2 text-sm text-[#475569]">
          FileIQ moves supplier files through a provenance-tracked pipeline. Phase 1.1 adds the source
          registry tables and the Source Bundles route — extraction runtime wires in Phase 1.2.
        </p>
        <ol className="mt-4 grid gap-2">
          {ingestionStages.map((stage, index) => (
            <li
              key={stage.title}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] px-4 py-3"
            >
              <p className="text-sm font-semibold text-[#0F172A]">
                {index + 1}. {stage.title}
              </p>
              <p className="mt-1 text-xs text-[#475569]">{stage.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="fileiq-agent-backbone-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Claude Agent SDK Backbone</h2>
          <p className="mt-2 text-sm text-[#475569]">
            Extraction jobs run as Claude Agent SDK sessions. The agent is granted a bounded tool registry and each
            session id is persisted for monitoring and retry.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {agentCapabilities.map((capability) => (
              <li
                key={capability.label}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-3 py-2"
              >
                <p className="text-sm font-medium text-[#0F172A]">{capability.label}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{capability.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg border border-dashed border-[#D9E4F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#475569]">
            Credentials come from the <code className="text-[#0F172A]">ANTHROPIC_API_KEY</code> environment variable.
            No agent session is started during page render in Phase 1.0.
          </p>
        </article>

        <article
          className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
          data-testid="fileiq-downstream-panel"
        >
          <h2 className="text-lg font-semibold text-[#0F172A]">Downstream Brain Consumers</h2>
          <p className="mt-2 text-sm text-[#475569]">
            Approved canonical facts are written to the shared ecommerce database. Downstream brains read approved
            facts; they do not re-extract source files.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {fileIqDownstreamBrains.map((brain) => (
              <li
                key={brain}
                className="inline-flex items-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#1D4ED8]"
              >
                {downstreamBrainLabels[brain]}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
            Planned shared-DB tables
          </h3>
          <ul className="mt-2 grid gap-1">
            {fileIqPlannedTables.map((table) => (
              <li key={table} className="text-xs text-[#334155]">
                <code className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[#0F172A]">{table}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[#64748B]">
            Migration state: planning-only. No migrations run in Phase 1.0.
          </p>
        </article>
      </section>
    </div>
  );
}
