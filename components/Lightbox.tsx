"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import CarouselDots from "./CarouselDots";

type Props = {
  images: string[];
  alt: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export default function Lightbox({ images, alt, title, subtitle, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const hasMultiple = images.length > 1;

  function goPrev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function goNext() {
    setIndex((i) => (i + 1) % images.length);
  }

  // Navigasi keyboard: panah kiri/kanan untuk ganti foto, Esc untuk tutup.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (hasMultiple && e.key === "ArrowLeft") goPrev();
      if (hasMultiple && e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMultiple, images.length]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-charcoal-950/90 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full overflow-hidden rounded-xl2 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-950/70 text-white hover:bg-orange-500 transition-colors"
        >
          <X size={18} />
        </button>

        {hasMultiple && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-charcoal-950/70 px-3 py-1 text-xs font-semibold text-white">
            {index + 1} / {images.length}
          </span>
        )}

        <div className="relative aspect-[4/3] w-full bg-charcoal-950">
          <Image
            src={images[index]}
            alt={`${alt} — foto ${index + 1}`}
            fill
            unoptimized={images[index].endsWith(".svg")}
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover"
          />

          {hasMultiple && (
            <>
              <button
                onClick={goPrev}
                aria-label="Foto sebelumnya"
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-950/70 text-white hover:bg-orange-500 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goNext}
                aria-label="Foto berikutnya"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-950/70 text-white hover:bg-orange-500 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex items-center justify-center py-3">
            <CarouselDots count={images.length} active={index} onSelect={setIndex} />
          </div>
        )}

        {(title || subtitle) && (
          <div className="p-5 pt-0">
            {title && <p className="text-base font-bold text-charcoal-950">{title}</p>}
            {subtitle && <p className="mt-1 text-sm text-charcoal-400">{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
