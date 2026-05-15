import type { ShopifyReadinessDimensionScore } from "@/lib/ecomviper/shopify/shopify-agentic-types";

interface ShopifyReadinessCardProps {
  dimension: ShopifyReadinessDimensionScore;
}

function statusClass(status: ShopifyReadinessDimensionScore["status"]): string {
  if (status === "excellent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "good") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "needs_work") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export default function ShopifyReadinessCard({ dimension }: ShopifyReadinessCardProps) {
  return (
    <article className="rounded-xl border border-[#D9E4F0] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0F172A]">{dimension.label}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(dimension.status)}`}>
          {dimension.status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{dimension.value}</p>
      <p className="mt-1 text-xs text-[#64748B]">{dimension.explanation}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#475569]">
        {dimension.recommendedActions.slice(0, 2).map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </article>
  );
}
