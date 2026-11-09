"use client";

import Image from "next/image";
import { useState } from "react";

type HeroCompareProps = {
  rating: string;
};

export default function HeroCompare({ rating }: HeroCompareProps) {
  const [position, setPosition] = useState(50);
  const hasRating = rating !== "—";

  return (
    <div className="blueprint-frame relative h-[320px] overflow-hidden rounded-[1.25rem] border border-white/10 sm:h-[420px] lg:h-[520px]">
      <Image
        src="/images/compare-after.png"
        alt="Hasil proyek properti Dzaroza Property"
        fill
        priority
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (min-width: 1024px) 45vw, 80vw"
      />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Image
          src="/images/compare-before.png"
          alt="Kondisi awal atau konsep sebelum pengerjaan properti"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (min-width: 1024px) 45vw, 80vw"
        />
      </div>

      <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-charcoal-950/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-card">
        Before
      </span>
      <span className="absolute right-4 top-4 rounded-full border border-orange-400 bg-orange-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-charcoal-950 shadow-card">
        After
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.5)]"
        style={{ left: `${position}%` }}
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-charcoal-950 text-white shadow-card">
          <span className="text-base font-semibold leading-none tracking-[-0.18em]" aria-hidden="true">&lt;  &gt;</span>
        </div>
      </div>

      <input
        type="range"
        min="8"
        max="92"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Geser untuk membandingkan kondisi awal dan hasil proyek"
        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
      />

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-charcoal-950/95 px-3 py-3 text-white shadow-card backdrop-blur sm:bottom-5 sm:left-5 sm:right-5 sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/65">Ulasan Klien</p>
          {hasRating ? (
            <p className="mt-1 whitespace-nowrap text-base font-bold text-orange-400 sm:text-xl">{rating} / 5.0</p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-white sm:text-base">Mengutamakan amanah</p>
          )}
        </div>
        <div className="h-9 w-px shrink-0 bg-white/25" />
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/65">Prinsip Kerja</p>
          <p className="mt-1 text-xs font-bold leading-snug text-orange-400 sm:text-base">Akad Jelas · Bebas Gharar</p>
        </div>
      </div>
    </div>
  );
}
