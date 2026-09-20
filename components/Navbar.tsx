"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

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
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // "Auto section jump": scroll halus ke anchor tanpa reload halaman.
  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    setOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", href);
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-md shadow-card" : "bg-white/0"
      }`}
    >
      <nav className="container-content flex items-center justify-between px-6 sm:px-10 lg:px-16 py-4">
        <Link
          href="/"
          className="flex items-center"
          aria-label="Dzaroza Property — Beranda"
        >
          <Image
            src="/images/logo-1.svg"
            alt="Dzaroza Property"
            width={180}
            height={38}
            className="h-8 sm:h-9 w-auto"
            priority
          />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              className="text-sm font-medium text-charcoal-600 hover:text-orange-700 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="#produk"
          onClick={(e) => handleAnchorClick(e, "#produk")}
          className="hidden lg:inline-flex items-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-charcoal-950 shadow-card hover:bg-orange-400 transition-colors"
        >
          Lihat Produk
        </a>

        <button
          aria-label="Buka menu"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-charcoal-100 text-charcoal-950"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-charcoal-100 bg-white px-6 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-charcoal-800 hover:bg-cream-soft hover:text-orange-700"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
