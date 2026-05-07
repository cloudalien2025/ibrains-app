import WalmartPageHeader from "@/app/apps/ecomviper/walmart/_components/page-header";
import StatusBadge from "@/app/apps/ecomviper/walmart/_components/status-badge";
import { listActivityLogs } from "@/lib/ecomviper/core/activity-log";
import { getWalmartRuntimeMode } from "@/lib/ecomviper/walmart/walmart-mock-data";

export const dynamic = "force-dynamic";

export default function WalmartActivityPage() {
  const entries = listActivityLogs({ marketplace: "walmart", limit: 120 });

  return (
    <div className="space-y-4" data-testid="ecomviper-walmart-activity-page">
      <WalmartPageHeader
        title="Activity Log"
        subtitle="Audit trail for connection tests, imports, drafts, updates, feeds, and AI actions."
        mode={getWalmartRuntimeMode()}
      />

      <section className="rounded-2xl border border-[#D9E4F0] bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-[#64748B]">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">Actor</th>
                <th className="py-2">Action</th>
                <th className="py-2">SKU</th>
                <th className="py-2">Result</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-[#E2E8F0] align-top">
                  <td className="py-2 pr-2 text-[#334155]">{entry.createdAt}</td>
                  <td className="py-2 pr-2 text-[#334155]">{entry.actor ?? "system"}</td>
                  <td className="py-2 pr-2 text-[#334155]">{entry.actionType}</td>
                  <td className="py-2 pr-2 text-[#334155]">{entry.sku ?? "-"}</td>
                  <td className="py-2 pr-2"><StatusBadge status={entry.result} /></td>
                  <td className="py-2 text-[#334155]">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
