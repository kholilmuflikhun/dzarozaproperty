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
          className="object-cover"
          sizes="(min-width: 1024px) 45vw, 100vw"
        />
      </div>

      <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        Before / Konsep
      </span>
      <span className="absolute right-4 top-4 rounded-full border border-white/35 bg-orange-500/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        After / Hasil
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-gradient-to-b from-white/20 via-white to-white/20 shadow-[0_0_18px_rgba(255,255,255,0.5)]"
        style={{ left: `${position}%` }}
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-white/20 text-white shadow-[0_8px_30px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.7)] backdrop-blur-xl">
          <span className="text-lg font-semibold leading-none tracking-[-0.18em]" aria-hidden="true">&lt;&gt;</span>
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

      <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-transparent to-transparent" />
      <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-xl bg-white/95 px-5 py-4 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Kepuasan Klien</p>
          <p className="text-xl font-bold text-orange-500">{rating} / 5.0</p>
        </div>
        <div className="h-10 w-px bg-charcoal-100" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Prinsip</p>
          <p className="text-xl font-bold text-charcoal-950">Bebas Gharar</p>
        </div>
      </div>
    </div>
  );
}
