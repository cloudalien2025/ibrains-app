import CreateBrainDialog from "../_components/CreateBrainDialog";

export default function AddBrainPage() {
  return (
    <section className="rounded-[28px] border border-[#D9E4F0] bg-white/95 p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="text-xs uppercase tracking-[0.2em] text-[#64748B]">Brains</div>
      <h2 className="mt-2 text-3xl font-semibold text-[#0F172A]">Add Brain</h2>
      <p className="mt-2 max-w-2xl text-sm text-[#334155]">Create and register a new brain in the iBrains workspace.</p>
      <div className="mt-4"><CreateBrainDialog /></div>
    </section>
  );
}
