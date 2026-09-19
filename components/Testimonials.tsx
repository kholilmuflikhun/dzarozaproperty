"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import TestimoniForm from "./TestimoniForm";
import TestimoniStats from "./TestimoniStats";
import CarouselDots from "./CarouselDots";
import { useColumns } from "@/lib/useColumns";
import type { Testimonial } from "@/lib/data";

const AUTO_SLIDE_MS = 5000;

const PALETTE = ["#FF8C00", "#0F0F10", "#FF8C00", "#1C1C1E"];
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return Math.abs(hash);
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    return <Image src={photo} alt={name} width={44} height={44} className="rounded-full object-cover" />;
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const bg = PALETTE[hashString(name) % PALETTE.length];
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {initials}
    </span>
  );
}

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  // Kartu per slide mengikuti jumlah kolom grid aktif (mobile 1, tablet 2,
  // desktop 4) supaya tampilan carousel konsisten dengan layout grid semula.
  const columns = useColumns({ sm: 2, lg: 4 });

  useEffect(() => {
    fetch("/api/testimoni")
      .then((res) => res.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]));
  }, []);

  const pages = useMemo(() => {
    const chunks: Testimonial[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      chunks.push(items.slice(i, i + columns));
    }
    return chunks.length ? chunks : [[]];
  }, [items, columns]);

  // Reset ke slide pertama tiap kali jumlah kolom (resize layar) atau data
  // testimoni berubah, supaya index yang aktif tidak pernah "kelewat".
  useEffect(() => {
    setPage(0);
  }, [columns, items.length]);

  const safePage = Math.min(page, pages.length - 1);

  function goPrev() {
    setPage((p) => (p - 1 + pages.length) % pages.length);
  }
  function goNext() {
    setPage((p) => (p + 1) % pages.length);
  }

  // Auto-slide testimoni setiap beberapa detik, berhenti sementara saat
  // pointer/jari user berada di area carousel supaya nyaman dibaca.
  useEffect(() => {
    if (pages.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setPage((currentPage) => (currentPage + 1) % pages.length);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [pages.length, paused]);

  const currentItems = pages[safePage] ?? [];

  return (
    <section id="testimoni" className="section-pad bg-white">
      <div className="container-content">
        <SectionHeading
          eyebrow="Review & Testimoni"
          title="Apa Kata Klien Kami"
          description="Kepercayaan (amanah) klien adalah fondasi dari setiap proyek yang kami kerjakan."
        />

        <div
          className="relative mt-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div key={safePage} className="grid animate-fadeIn sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {currentItems.map((t) => (
              <div key={t.id} className="rounded-xl2 border border-charcoal-100 bg-cream-soft p-6">
                <Quote className="text-orange-500/40" size={26} />
                <p className="mt-3 text-sm text-charcoal-800 leading-relaxed min-h-[70px]">
                  &ldquo;{t.message}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <Avatar name={t.name} photo={t.photo} />
                  <div>
                    <p className="text-sm font-bold text-charcoal-950">{t.name}</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={i < t.rating ? "fill-orange-500 text-orange-500" : "text-charcoal-100"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {currentItems.length === 0 && (
              <p className="col-span-full text-center text-sm text-charcoal-400">Belum ada testimoni.</p>
            )}
          </div>

          {pages.length > 1 && (
            <>
              <button
                onClick={goPrev}
                aria-label="Testimoni sebelumnya"
                className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 lg:flex h-11 w-11"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goNext}
                aria-label="Testimoni berikutnya"
                className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal-100 bg-white shadow-card transition-colors hover:border-orange-400 lg:flex h-11 w-11"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {pages.length > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={goPrev}
              aria-label="Testimoni sebelumnya"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-100 lg:hidden"
            >
              <ChevronLeft size={16} />
            </button>

            <CarouselDots count={pages.length} active={safePage} onSelect={setPage} />

            <button
              onClick={goNext}
              aria-label="Testimoni berikutnya"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-100 lg:hidden"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div className="mt-12 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <TestimoniForm />
          <TestimoniStats items={items} />
        </div>
      </div>
    </section>
  );
}