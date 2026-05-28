import Link from "next/link";

export default function TasksPage() {
  return (
    <section className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Tasks</div>
      <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">Task Queue</h2>
      <p className="mt-2 max-w-2xl text-sm text-[#334155]">Operational tasks are tracked through the run system.</p>
      <div className="mt-4">
        <Link href="/runs" className="inline-flex rounded-full border border-[#D9E4F0] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FBFF]">View Task Runs</Link>
      </div>
    </section>
  );
}
