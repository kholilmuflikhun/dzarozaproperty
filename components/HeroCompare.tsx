"use client";

import Image from "next/image";
import { useState } from "react";

type HeroCompareProps = {
  rating: string;
};

export default function HeroCompare({ rating }: HeroCompareProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className="blueprint-frame relative h-[520px] overflow-hidden rounded-xl2 border border-white/10">
      <Image
        src="/images/compare-after.png"
        alt="Hasil proyek properti Dzaroza Property"
        fill
        priority
        className="object-cover"
        sizes="(min-width: 1024px) 45vw, 100vw"
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image
          src="/images/compare-before.png"
          alt="Konsep rumah dari Dzaroza Property"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(min-width: 1024px) 45vw, 100vw"
        />
      </div>

      <span className="absolute left-4 top-4 rounded-full border border-charcoal-600 bg-charcoal-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        Before
      </span>
      <span className="absolute right-4 top-4 rounded-full border border-orange-600 bg-orange-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-950 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        After
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.5)]"
        style={{ left: `${position}%` }}
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-600 bg-charcoal-950 text-white shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
          <span className="text-base font-semibold leading-none tracking-[-0.18em]" aria-hidden="true">&lt;  &gt;</span>
        </div>
      </div>

      <input
        type="range"
        min="8"
        max="92"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Geser untuk membandingkan gambar konsep dan hasil proyek"
        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
      />

      <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-xl border border-charcoal-600 bg-charcoal-950 px-5 py-4 text-white shadow-[0_12px_35px_rgba(0,0,0,0.28)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Kepuasan Klien</p>
          <p className="text-xl font-bold text-orange-500">{rating} / 5.0</p>
        </div>
        <div className="h-10 w-px bg-white/30" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Prinsip</p>
          <p className="text-xl font-bold text-white">Bebas Gharar</p>
        </div>
      </div>
    </div>
  );
}
