"use client";

import { X, Clock } from "lucide-react";
import CountdownTimer from "./CountdownTimer";

type Props = {
  productTitle: string;
  releaseDate?: string;
  onClose: () => void;
};

export default function ComingSoonModal({ productTitle, releaseDate, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-charcoal-950/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl2 bg-white p-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 text-charcoal-400 hover:text-orange-500 transition-colors"
        >
          <X size={18} />
        </button>

        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
          <Clock size={26} />
        </span>

        <h3 className="mt-4 text-lg font-bold text-charcoal-950">Produk Belum Dirilis</h3>
        <p className="mt-2 text-sm text-charcoal-400 leading-relaxed">
          &ldquo;{productTitle}&rdquo; masih berstatus <span className="font-semibold text-charcoal-700">Coming Soon</span> dan
          belum bisa dibeli saat ini. Nantikan rilisnya dalam:
        </p>

        {releaseDate ? (
          <div className="mt-5">
            <CountdownTimer releaseDate={releaseDate} />
          </div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-orange-700">
            Tanggal rilis akan diumumkan segera.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-charcoal-950 py-3 text-sm font-semibold text-white hover:bg-orange-500 hover:text-charcoal-950 transition-colors"
        >
          Oke, Mengerti
        </button>
      </div>
    </div>
  );
}
