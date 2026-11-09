"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MapPin, Calendar, Images, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Lightbox from "./Lightbox";
import CarouselDots from "./CarouselDots";
import { useColumns } from "@/lib/useColumns";
import { portfolioProjects, type PortfolioProject } from "@/lib/data";

const FILTERS = ["Semua", "Interior", "Eksterior"] as const;
const MAX_ROWS = 1;
const TAG_COLOR: Record<string, string> = {
  "Bangunan Baru": "bg-orange-500 text-charcoal-950",
  "Renovasi Bangunan": "bg-charcoal-800 text-white",
  "Titip & Menjualkan": "bg-orange-700 text-white",
};

export default function Portfolio() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Semua");
  const [active, setActive] = useState<PortfolioProject | null>(null);
  const [page, setPage] = useState(0);
  const columns = useColumns({ sm: 2, lg: 3 });

  const filtered = useMemo(() => filter === "Semua" ? portfolioProjects : portfolioProjects.filter((project) => project.categories.includes(filter)), [filter]);
  const itemsPerPage = columns * MAX_ROWS;
  const pages = useMemo(() => {
    const chunks: PortfolioProject[][] = [];
    for (let i = 0; i < filtered.length; i += itemsPerPage) chunks.push(filtered.slice(i, i + itemsPerPage));
    return chunks.length ? chunks : [[]];
  }, [filtered, itemsPerPage]);

  useEffect(() => setPage(0), [filter, itemsPerPage]);

  const safePage = Math.min(page, pages.length - 1);
  const currentItems = pages[safePage] ?? [];
  const canPrev = safePage > 0;
  const canNext = safePage < pages.length - 1;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressCardClick = useRef(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Kartu portofolio sendiri berupa <button>; jangan mengecualikannya,
    // karena area kartu adalah area utama untuk memulai gesture swipe.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return;
    const deltaX = e.clientX - swipeStart.current.x;
    const deltaY = e.clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
    // Mencegah click sintetis setelah swipe membuka Lightbox secara tidak sengaja.
    suppressCardClick.current = true;
    if (deltaX < 0 && canNext) setPage(safePage + 1);
    else if (deltaX > 0 && canPrev) setPage(safePage - 1);
  }

  return (
    <section id="portofolio" className="section-pad bg-cream-soft">
      <div className="container-content">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Portofolio Project"
            title="Hasil Kerja Nyata di Lapangan"
            description="Sebagian proyek bangun, renovasi, dan titip-jual properti yang telah kami kerjakan bersama klien."
          />

          <div className="flex max-w-full gap-2 overflow-x-auto py-1 no-scrollbar" role="group" aria-label="Filter kategori portofolio">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
                className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                  filter === item ? "bg-orange-500 text-charcoal-950" : "border border-charcoal-100 bg-white text-charcoal-600 hover:border-orange-400 hover:text-orange-800"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-9 sm:mt-12">
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { swipeStart.current = null; }}
            onClickCapture={(event) => {
              if (!suppressCardClick.current) return;
              suppressCardClick.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
            role="region"
            aria-label="Carousel portofolio proyek"
            aria-roledescription="carousel"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft" && canPrev) { event.preventDefault(); setPage(safePage - 1); }
              if (event.key === "ArrowRight" && canNext) { event.preventDefault(); setPage(safePage + 1); }
            }}
            className="grid animate-carousel-enter touch-pan-y select-none gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          >
            {currentItems.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setActive(project)}
                aria-label={`Lihat foto proyek: ${project.title}`}
                className="group min-w-0 overflow-hidden rounded-2xl border border-charcoal-100 bg-white text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-charcoal-100">
                  <Image
                    src={project.images[0]}
                    alt={project.title}
                    fill
                    unoptimized={project.images[0].endsWith(".svg")}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-charcoal-950/90 px-3 py-1.5 text-[10px] font-bold text-white sm:text-xs">
                    {project.categories.join(" / ")}
                  </span>
                  <span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-bold sm:text-xs ${TAG_COLOR[project.tag]}`}>
                    {project.tag}
                  </span>
                  {project.images.length > 1 && (
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-charcoal-950/90 px-3 py-1.5 text-xs font-semibold text-white">
                      <Images size={13} aria-hidden="true" /> {project.images.length} foto
                    </span>
                  )}
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-charcoal-950 opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Lihat proyek <ArrowUpRight size={13} aria-hidden="true" />
                  </span>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="line-clamp-2 text-base font-bold leading-snug text-charcoal-950 sm:text-lg">{project.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-charcoal-600">{project.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-charcoal-100 pt-4 text-xs text-charcoal-500">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} className="shrink-0 text-orange-600" aria-hidden="true" />
                      {project.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} className="shrink-0 text-orange-600" aria-hidden="true" />
                      {project.year}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {currentItems.length === 0 && <p className="col-span-full py-10 text-center text-sm text-charcoal-500">Belum ada project untuk kategori ini.</p>}
          </div>

          {pages.length > 1 && (
            <>
              <button type="button" onClick={() => canPrev && setPage(safePage - 1)} disabled={!canPrev} aria-label="Halaman portofolio sebelumnya" className="absolute -left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex">
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={() => canNext && setPage(safePage + 1)} disabled={!canNext} aria-label="Halaman portofolio berikutnya" className="absolute -right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex">
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {pages.length > 1 && (
          <div className="mt-7 flex items-center justify-center gap-4">
            <button type="button" onClick={() => canPrev && setPage(safePage - 1)} disabled={!canPrev} aria-label="Portofolio sebelumnya" className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-100 transition-colors hover:border-orange-400 disabled:opacity-30 lg:hidden">
              <ChevronLeft size={17} />
            </button>
            <CarouselDots count={pages.length} active={safePage} onSelect={setPage} />
            <button type="button" onClick={() => canNext && setPage(safePage + 1)} disabled={!canNext} aria-label="Portofolio berikutnya" className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-100 transition-colors hover:border-orange-400 disabled:opacity-30 lg:hidden">
              <ChevronRight size={17} />
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
