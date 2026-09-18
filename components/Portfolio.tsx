"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MapPin, Calendar, Images, ChevronLeft, ChevronRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Lightbox from "./Lightbox";
import CarouselDots from "./CarouselDots";
import { useColumns } from "@/lib/useColumns";
import { portfolioProjects, type PortfolioProject } from "@/lib/data";

const FILTERS = ["Semua", "Interior", "Eksterior"] as const;
const MAX_ROWS = 1;

const TAG_COLOR: Record<string, string> = {
  "Bangunan Baru": "bg-orange-500",
  "Renovasi Bangunan": "bg-charcoal-800",
  "Titip & Menjualkan": "bg-orange-700",
};

export default function Portfolio() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Semua");
  const [active, setActive] = useState<PortfolioProject | null>(null);
  const [page, setPage] = useState(0);
  const columns = useColumns({ sm: 2, lg: 3 });

  const filtered = useMemo(() => {
    if (filter === "Semua") return portfolioProjects;
    return portfolioProjects.filter((p) => p.categories.includes(filter as any));
  }, [filter]);

  const itemsPerPage = columns * MAX_ROWS;

  const pages = useMemo(() => {
    const chunks: PortfolioProject[][] = [];
    for (let i = 0; i < filtered.length; i += itemsPerPage) {
      chunks.push(filtered.slice(i, i + itemsPerPage));
    }
    return chunks.length ? chunks : [[]];
  }, [filtered, itemsPerPage]);

  // Reset ke halaman pertama setiap kali filter kategori berganti, atau
  // jumlah kolom berubah (mis. resize dari desktop ke mobile).
  useEffect(() => {
    setPage(0);
  }, [filter, itemsPerPage]);

  const safePage = Math.min(page, pages.length - 1);
  const currentItems = pages[safePage] ?? [];
  const canPrev = safePage > 0;
  const canNext = safePage < pages.length - 1;

  // Swipe (sentuh/drag) untuk pindah halaman — Pointer Events mencakup jari
  // (mobile/tablet), stylus, dan mouse-drag (desktop layar sentuh) sekaligus.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 40; // px minimal geser supaya dianggap swipe, bukan tap

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    swipeStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return;
    const deltaX = e.clientX - swipeStart.current.x;
    const deltaY = e.clientY - swipeStart.current.y;
    swipeStart.current = null;

    // Abaikan kalau gerakannya lebih vertikal (user memang mau scroll halaman)
    // atau terlalu pendek (dianggap tap/klik biasa, bukan swipe).
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0 && canNext) setPage(safePage + 1); // geser ke kiri -> halaman berikutnya
    else if (deltaX > 0 && canPrev) setPage(safePage - 1); // geser ke kanan -> halaman sebelumnya
  }

  function handlePointerCancel() {
    swipeStart.current = null;
  }

  return (
    <section id="portofolio" className="section-pad bg-cream-soft">
      <div className="container-content">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <SectionHeading
            eyebrow="Portofolio Project"
            title="Hasil Kerja Nyata di Lapangan"
            description="Sebagian proyek bangun, renovasi, dan titip-jual properti yang telah kami kerjakan bersama klien."
          />

          <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 -mx-6 px-6 sm:mx-0 sm:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
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

        <div className="relative mt-12">
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="grid touch-pan-y select-none sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {currentItems.map((p) => (
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

            {currentItems.length === 0 && (
              <p className="col-span-full text-center text-sm text-charcoal-400">
                Belum ada project untuk kategori ini.
              </p>
            )}
          </div>

          {pages.length > 1 && (
            <>
              <button
                onClick={() => canPrev && setPage(safePage - 1)}
                disabled={!canPrev}
                aria-label="Halaman sebelumnya"
                className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex h-11 w-11"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => canNext && setPage(safePage + 1)}
                disabled={!canNext}
                aria-label="Halaman berikutnya"
                className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex h-11 w-11"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {pages.length > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => canPrev && setPage(safePage - 1)}
              disabled={!canPrev}
              aria-label="Halaman sebelumnya"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-100 disabled:opacity-30 lg:hidden"
            >
              <ChevronLeft size={16} />
            </button>

            <CarouselDots count={pages.length} active={safePage} onSelect={setPage} />

            <button
              onClick={() => canNext && setPage(safePage + 1)}
              disabled={!canNext}
              aria-label="Halaman berikutnya"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-100 disabled:opacity-30 lg:hidden"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
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