import { Lock } from "lucide-react";
import { brainTheme } from "@/components/brain-dock/brainTheme";

type LockedBrainViewProps = {
  title: string;
  message: string;
  ctaLabel?: string;
};

export default function LockedBrainView({ title, message, ctaLabel = "Request Access" }: LockedBrainViewProps) {
  return (
    <div className="ecomviper-hud min-h-screen text-[#0F172A]">
      <div className="ecomviper-vignette pointer-events-none fixed inset-0" />
      <div className="ecomviper-grid pointer-events-none fixed inset-0 opacity-40" />

      <main className="relative mx-auto flex min-h-screen max-w-4xl items-center px-6 py-10">
        <section className={`${brainTheme.glassCard} w-full p-8`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/55 bg-amber-100 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Locked
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-[#0F172A]">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#334155]">{message}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled className={`${brainTheme.glowButton} cursor-not-allowed opacity-70`} aria-disabled="true">
              {ctaLabel}
            </button>
            <p className="self-center text-xs text-[#64748B]">Access is managed by entitlements. Contact your workspace admin.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
