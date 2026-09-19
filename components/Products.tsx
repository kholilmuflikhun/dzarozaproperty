"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, GraduationCap, Package, Check, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import PurchaseButton from "./PurchaseButton";
import ProductStatusBadge from "./ProductStatusBadge";
import CarouselDots from "./CarouselDots";
import { products, type Product } from "@/lib/data";

const ICONS: Record<string, typeof BookOpen> = { "E-Book": BookOpen, "E-Class": GraduationCap };
const MAX_ROWS = 1; // tiap "halaman" carousel cuma 1 baris karena kartu produk cukup tinggi/detail

// Mendeteksi jumlah kolom grid aktif sesuai breakpoint yang dipakai (md:grid-cols-2)
// — mobile 1 kolom, tablet ke atas 2 kolom — supaya jumlah item per halaman pas.
function useColumns() {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function update() {
      setColumns(mq.matches ? 2 : 1);
    }
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return columns;
}

export default function Products() {
  const [page, setPage] = useState(0);
  const columns = useColumns();
  const itemsPerPage = columns * MAX_ROWS;

  const pages = useMemo(() => {
    const chunks: Product[][] = [];
    for (let i = 0; i < products.length; i += itemsPerPage) {
      chunks.push(products.slice(i, i + itemsPerPage));
    }
    return chunks.length ? chunks : [[]];
  }, [itemsPerPage]);

  // Kalau resize dari desktop (2 kolom) ke mobile (1 kolom) sedang di halaman
  // terakhir, halaman itu bisa jadi out-of-range — batasi otomatis di sini.
  useEffect(() => {
    setPage((p) => Math.min(p, pages.length - 1));
  }, [pages.length]);

  const safePage = Math.min(page, pages.length - 1);
  const currentItems = pages[safePage] ?? [];
  const canPrev = safePage > 0;
  const canNext = safePage < pages.length - 1;

  // Swipe (sentuh/drag) untuk pindah halaman — Pointer Events mencakup jari
  // (mobile/tablet), stylus, dan mouse-drag (desktop layar sentuh) sekaligus.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 40;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("a, button, input, textarea, select, [role='button']")) {
      swipeStart.current = null;
      return;
    }

    swipeStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return;
    const deltaX = e.clientX - swipeStart.current.x;
    const deltaY = e.clientY - swipeStart.current.y;
    swipeStart.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0 && canNext) setPage(safePage + 1);
    else if (deltaX > 0 && canPrev) setPage(safePage - 1);
  }

  function handlePointerCancel() {
    swipeStart.current = null;
  }

  return (
    <section id="produk" className="section-pad bg-white">
      <div className="container-content">
        <SectionHeading
          eyebrow="Produk Digital"
          title="Belajar Property Amanah Lewat E-Book & E-Class"
          description="Selain jasa lapangan, Dzaroza Property menghadirkan produk edukasi agar Anda lebih paham seluk-beluk pengelolaan properti yang transparan dan bebas gharar."
        />

        <div className="relative mt-12">
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="grid touch-pan-y select-none md:grid-cols-2 gap-6"
          >
            {currentItems.map((p) => {
              const Icon = ICONS[p.type] ?? Package;
              return (
                <div
                  key={p.slug}
                  className="group flex flex-col overflow-hidden rounded-xl2 border border-charcoal-100 bg-cream-soft hover:shadow-card-hover hover:border-orange-200 transition-all"
                >
                  <div className="relative h-52 w-full bg-charcoal-950">
                    <Image
                      src={p.cover}
                      alt={p.title}
                      fill
                      unoptimized={p.cover.endsWith(".svg")}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-charcoal-950/85 px-3 py-1.5 text-xs font-semibold text-orange-400">
                      <Icon size={14} />
                      {p.type}
                    </span>
                    <ProductStatusBadge status={p.status} className="absolute top-3 right-3" />
                    {p.videoUrl && (
                      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-charcoal-950/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                        <PlayCircle size={12} />
                        Video
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-7">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-bold text-charcoal-950">{p.title}</h3>
                      <span className="shrink-0 text-lg font-bold text-orange-500">{p.price}</span>
                    </div>
                    <p className="mt-2 text-sm text-charcoal-400 leading-relaxed">{p.summary}</p>

                    <ul className="mt-5 space-y-2.5 flex-1">
                      {p.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-charcoal-800">
                          <Check size={16} className="mt-0.5 shrink-0 text-orange-500" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 flex items-center gap-3">
                      <Link
                        href={`/produk/${p.slug}`}
                        className="inline-flex items-center justify-center rounded-full border border-charcoal-100 px-5 py-3 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-500 transition-colors"
                      >
                        Detail
                      </Link>
                      <PurchaseButton
                        label={p.ctaLabel}
                        productSlug={p.slug}
                        productTitle={p.title}
                        productType={p.type}
                        status={p.status}
                        releaseDate={p.releaseDate}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
    </section>
  );
}