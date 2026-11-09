"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";

const NAV_LINKS = [
  { href: "#produk", label: "Produk Digital" },
  { href: "#layanan", label: "Layanan" },
  { href: "#portofolio", label: "Portofolio" },
  { href: "#testimoni", label: "Testimoni" },
  { href: "#profil", label: "Company Profile" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    setOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", href);
  }

  return (
    <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${scrolled ? "border-charcoal-100 bg-white/95 shadow-card backdrop-blur-xl" : "border-transparent bg-white"}`}>
      <nav aria-label="Navigasi utama" className="container-content flex min-h-[76px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" aria-label="Dzaroza Property — Beranda">
          <Image src="/images/logo-1.svg" alt="Dzaroza Property" width={180} height={38} className="h-8 w-auto sm:h-9" priority />
        </Link>

        <div className="hidden items-center gap-5 xl:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={(e) => handleAnchorClick(e, link.href)} className="whitespace-nowrap rounded-md py-2 text-[13px] font-semibold text-charcoal-600 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              {link.label}
            </a>
          ))}
        </div>

        <a href="#produk" onClick={(e) => handleAnchorClick(e, "#produk")} className="ml-auto hidden min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-charcoal-950 shadow-card transition-all hover:-translate-y-0.5 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 lg:inline-flex">
          Lihat Produk <ArrowUpRight size={16} />
        </a>

        <button type="button" aria-label={open ? "Tutup menu" : "Buka menu"} aria-expanded={open} aria-controls="mobile-primary-navigation" onClick={() => setOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal-100 bg-white text-charcoal-950 transition-colors hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 xl:hidden">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div id="mobile-primary-navigation" className="border-t border-charcoal-100 bg-white px-5 pb-5 pt-3 shadow-card sm:px-8 xl:hidden">
          <div className="mx-auto grid max-w-content gap-1">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={(e) => handleAnchorClick(e, link.href)} className="flex min-h-12 items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-charcoal-800 transition-colors hover:bg-cream-soft hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                {link.label}
                <ArrowUpRight size={15} className="text-charcoal-400" />
              </a>
            ))}
            <a href="#produk" onClick={(e) => handleAnchorClick(e, "#produk")} className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-charcoal-950">
              Lihat Produk <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
