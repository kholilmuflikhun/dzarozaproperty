"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, Calendar, Images } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Lightbox from "./Lightbox";
import { portfolioProjects, type PortfolioProject } from "@/lib/data";

const FILTERS = ["Semua", "Interior", "Eksterior"] as const;

const TAG_COLOR: Record<string, string> = {
  "Bangunan Baru": "bg-orange-500",
  "Renovasi Bangunan": "bg-charcoal-800",
  "Titip & Menjualkan": "bg-orange-700",
};

export default function Portfolio() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Semua");
  const [active, setActive] = useState<PortfolioProject | null>(null);

  const filtered = useMemo(() => {
  if (filter === "Semua") return portfolioProjects;
  return portfolioProjects.filter((p) => p.categories.includes(filter));
}, [filter]);

  return (
    <section id="portofolio" className="section-pad bg-cream-soft">
      <div className="container-content">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <SectionHeading
            eyebrow="Portofolio Project"
            title="Hasil Kerja Nyata di Lapangan"
            description="Sebagian proyek bangun, renovasi, dan titip-jual properti yang telah kami kerjakan bersama klien."
          />

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  filter === f
                    ? "bg-orange-500 text-white"
                    : "bg-white text-charcoal-600 border border-charcoal-100 hover:border-orange-400"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p)}
              className="group relative overflow-hidden rounded-xl2 bg-white shadow-card hover:shadow-card-hover transition-shadow text-left"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={p.images[0]}
                  alt={p.title}
                  fill
                  unoptimized={p.images[0].endsWith(".svg")}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-charcoal-950/85 px-3 py-1 text-[11px] font-semibold text-orange-400">
                {p.categories.join(" / ")}
                </span>
                <span
                  className={`absolute top-3 right-3 rounded-full px-3 py-1 text-[11px] font-semibold text-white ${TAG_COLOR[p.tag]}`}
                >
                  {p.tag}
                </span>
                {p.images.length > 1 && (
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-charcoal-950/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Images size={12} />
                    {p.images.length} foto
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-charcoal-950 leading-snug">{p.title}</h3>
                <p className="mt-2 text-sm text-charcoal-400 leading-relaxed">{p.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-charcoal-400">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-orange-500" />
                    {p.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-orange-500" />
                    {p.year}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-charcoal-400">
              Belum ada project untuk kategori ini.
            </p>
          )}
        </div>
      </div>

      {active && (
        <Lightbox
          images={active.images}
          alt={active.title}
          title={active.title}
          subtitle={`${active.categories.join(" / ")} • ${active.tag} • ${active.location}, ${active.year}`}
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}
