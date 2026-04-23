"use client";

import { useMemo, useState } from "react";

type ListingHeroProps = {
  title: string;
  subtitle?: string;
  imageUrl: string | null;
  score: number;
  chips: Array<{
    label: string;
    tone: "good" | "warn" | "neutral";
  }>;
};

function chipToneClass(tone: "good" | "warn" | "neutral"): string {
  if (tone === "good") return "border-emerald-300/40 bg-emerald-400/10 text-emerald-700";
  if (tone === "warn") return "border-amber-300/40 bg-amber-400/10 text-amber-700";
  return "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]";
}

export default function ListingHero({ title, subtitle = "AI Visibility", imageUrl, score, chips }: ListingHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const placeholderImage =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fbff"/>
            <stop offset="55%" stop-color="#eaf1f8"/>
            <stop offset="100%" stop-color="#dbeafe"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="600" fill="url(#bg)"/>
      </svg>`
    );
  const heroImageSrc = imageUrl && !imageFailed ? imageUrl : placeholderImage;
  const visibleChips = useMemo(() => chips.slice(0, 2), [chips]);

  return (
    <section
      data-testid="directoryiq-listing-hero"
      className="relative h-[200px] overflow-hidden rounded-2xl border border-[#D9E4F0] bg-white/95 sm:h-[260px] lg:h-[320px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-testid="directoryiq-hero-image"
        src={heroImageSrc}
        alt={`Image of ${title}`}
        loading="eager"
        decoding="async"
        onError={() => setImageFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[#F8FBFF]/90 via-[#F1F5F9]/65 to-[#DBEAFE]/40" />

      <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="hidden justify-end md:flex">
          <div
            data-testid="directoryiq-hero-glass-panel"
            className="w-64 rounded-2xl border border-[#D9E4F0] bg-white/90 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-md"
          >
            <div className="text-[11px] uppercase tracking-[0.1em] text-[#64748B]">AI Selection Score</div>
            <div className="mt-1 text-4xl font-semibold text-[#0F172A]">{score}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleChips.map((chip) => (
                <span key={chip.label} className={`rounded-full border px-2 py-0.5 text-[11px] ${chipToneClass(chip.tone)}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold text-[#0F172A] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[#334155]">{subtitle}</p>
        </div>

        <div className="md:hidden">
          <div
            data-testid="directoryiq-hero-glass-panel"
            className="w-full rounded-2xl border border-[#D9E4F0] bg-white/90 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.1em] text-[#64748B]">AI Selection Score</div>
              <div className="text-2xl font-semibold text-[#0F172A]">{score}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleChips.map((chip) => (
                <span key={chip.label} className={`rounded-full border px-2 py-0.5 text-[11px] ${chipToneClass(chip.tone)}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
