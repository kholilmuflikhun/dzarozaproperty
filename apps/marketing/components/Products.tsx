"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, GraduationCap, Package, Check, PlayCircle, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import PurchaseButton from "./PurchaseButton";
import ProductStatusBadge from "./ProductStatusBadge";
import CarouselDots from "./CarouselDots";
import { products, type Product } from "@/lib/data";

const ICONS: Record<string, typeof BookOpen> = { "E-Book": BookOpen, "E-Class": GraduationCap };
const MAX_ROWS = 1;

function useColumns() {
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setColumns(mq.matches ? 2 : 1);
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
    for (let i = 0; i < products.length; i += itemsPerPage) chunks.push(products.slice(i, i + itemsPerPage));
    return chunks.length ? chunks : [[]];
  }, [itemsPerPage]);

  useEffect(() => setPage((current) => Math.min(current, pages.length - 1)), [pages.length]);

  const safePage = Math.min(page, pages.length - 1);
  const currentItems = pages[safePage] ?? [];
  const canPrev = safePage > 0;
  const canNext = safePage < pages.length - 1;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

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
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0 && canNext) setPage(safePage + 1);
    else if (deltaX > 0 && canPrev) setPage(safePage - 1);
  }

  return (
    <section id="produk" className="section-pad bg-white">
      <div className="container-content">
        <SectionHeading
          eyebrow="Produk Digital"
          title="Belajar Property Amanah Lewat E-Book & E-Class"
          description="Selain jasa lapangan, Dzaroza Property menghadirkan produk edukasi agar Anda lebih paham seluk-beluk pengelolaan properti yang transparan dan bebas gharar."
        />

        <div className="relative mt-10 sm:mt-12">
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { swipeStart.current = null; }}
            role="region"
            aria-label="Carousel produk digital"
            aria-roledescription="carousel"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft" && canPrev) { event.preventDefault(); setPage(safePage - 1); }
              if (event.key === "ArrowRight" && canNext) { event.preventDefault(); setPage(safePage + 1); }
            }}
            className="grid animate-carousel-enter touch-pan-y gap-5 select-none md:grid-cols-2 md:gap-6"
          >
            {currentItems.map((product) => {
              const Icon = ICONS[product.type] ?? Package;
              return (
                <article
                  key={product.slug}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-charcoal-100 bg-cream-soft transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-card-hover"
                >
                  <div className="relative aspect-[16/8] w-full overflow-hidden bg-charcoal-950 sm:aspect-[16/7]">
                    <Image
                      src={product.cover}
                      alt={product.title}
                      fill
                      unoptimized={product.cover.endsWith(".svg")}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-950/90 px-3 py-1.5 text-xs font-semibold text-orange-300">
                      <Icon size={14} aria-hidden="true" />
                      {product.type}
                    </span>
                    <ProductStatusBadge status={product.status} className="absolute right-4 top-4" />
                    {product.videoUrl && (
                      <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-charcoal-950/90 px-3 py-1.5 text-xs font-semibold text-white">
                        <PlayCircle size={13} aria-hidden="true" /> Video
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 text-lg font-bold leading-snug text-charcoal-950 sm:text-xl">{product.title}</h3>
                      <span className="shrink-0 rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-800 sm:text-base">{product.price}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-charcoal-600">{product.summary}</p>

                    <ul className="mt-5 flex-1 space-y-3">
                      {product.features.slice(0, 3).map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed text-charcoal-800">
                          <Check size={17} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 flex flex-col gap-3 border-t border-charcoal-100 pt-5 sm:flex-row sm:items-center">
                      <Link
                        href={`/produk/${product.slug}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-charcoal-200 px-5 py-3 text-sm font-semibold text-charcoal-800 transition-colors hover:border-orange-500 hover:bg-white hover:text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                      >
                        Detail Produk <ArrowUpRight size={15} aria-hidden="true" />
                      </Link>
                      <PurchaseButton
                        label={product.ctaLabel}
                        productSlug={product.slug}
                        productTitle={product.title}
                        productType={product.type}
                        status={product.status}
                        releaseDate={product.releaseDate}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {pages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => canPrev && setPage(safePage - 1)}
                disabled={!canPrev}
                aria-label="Halaman produk sebelumnya"
                className="absolute -left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => canNext && setPage(safePage + 1)}
                disabled={!canNext}
                aria-label="Halaman produk berikutnya"
                className="absolute -right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 disabled:opacity-30 lg:flex"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {pages.length > 1 && (
          <div className="mt-7 flex items-center justify-center gap-4">
            <button type="button" onClick={() => canPrev && setPage(safePage - 1)} disabled={!canPrev} aria-label="Produk sebelumnya" className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-100 transition-colors hover:border-orange-400 disabled:opacity-30 lg:hidden">
              <ChevronLeft size={17} />
            </button>
            <CarouselDots count={pages.length} active={safePage} onSelect={setPage} />
            <button type="button" onClick={() => canNext && setPage(safePage + 1)} disabled={!canNext} aria-label="Produk berikutnya" className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-100 transition-colors hover:border-orange-400 disabled:opacity-30 lg:hidden">
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
