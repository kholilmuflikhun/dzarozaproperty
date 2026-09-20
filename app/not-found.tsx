import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center bg-charcoal-950 text-white overflow-hidden">
      <div className="absolute inset-0 blueprint-bg opacity-20" />
      <div className="relative text-center px-6">
        <span className="eyebrow justify-center">
          <span className="h-px w-6 bg-orange-500" />
          Halaman Tidak Ditemukan
        </span>
        <h1 className="mt-4 font-display text-7xl sm:text-8xl font-bold text-orange-500">404</h1>
        <p className="mt-4 text-white/70 max-w-md mx-auto leading-relaxed">
          Halaman yang Anda cari tidak tersedia. Mari kembali ke beranda Dzaroza Property.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-charcoal-950 hover:bg-orange-400 transition-colors"
        >
          <Home size={16} />
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
