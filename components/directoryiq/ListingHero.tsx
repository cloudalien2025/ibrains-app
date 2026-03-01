import Image from "next/image";

type ListingHeroProps = {
  title: string;
  subtitle: string;
  imageUrl: string | null;
};

export default function ListingHero({ title, subtitle, imageUrl }: ListingHeroProps) {
  return (
    <section
      data-testid="directoryiq-listing-hero"
      className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 h-[210px] sm:h-[260px] lg:h-[320px]"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`Image of ${title}`}
          fill
          priority
          unoptimized
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
          className="object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-900/15" />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-200">{subtitle}</p>
      </div>
    </section>
  );
}
