"use client";

import { useEffect, useRef, useState } from "react";
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
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onClose]);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!hasMultiple || event.pointerType === "mouse") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a")) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return;
    const deltaX = event.clientX - swipeStart.current.x;
    const deltaY = event.clientY - swipeStart.current.y;
    swipeStart.current = null;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) goNext();
    else goPrev();
  }

  function goPrev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function goNext() {
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-charcoal-950/90 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Galeri foto"}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="relative max-w-2xl w-full overflow-hidden rounded-xl2 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-950/70 text-white hover:bg-orange-500 transition-colors"
        >
          <X size={18} />
        </button>

        {hasMultiple && (
          <span aria-live="polite" aria-atomic="true" className="absolute left-4 top-4 z-10 rounded-full bg-charcoal-950/70 px-3 py-1 text-xs font-semibold text-white">
            {index + 1} / {images.length}
          </span>
        )}

        <div
          className="relative aspect-[4/3] w-full touch-pan-y select-none bg-charcoal-950"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeStart.current = null; }}
          role="region"
          aria-label="Galeri foto"
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowLeft" && hasMultiple) { event.preventDefault(); goPrev(); }
            if (event.key === "ArrowRight" && hasMultiple) { event.preventDefault(); goNext(); }
          }}
        >
          <Image
            key={images[index]}
            src={images[index]}
            alt={`${alt} — foto ${index + 1}`}
            fill
            unoptimized={images[index].endsWith(".svg")}
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-contain"
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
