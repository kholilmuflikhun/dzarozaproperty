"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, Building2, BriefcaseBusiness, FileText, LayoutDashboard, Home,
  ReceiptText, Wallet, Menu, X
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "", label: "Ringkasan", short: "Home", icon: LayoutDashboard },
  { href: "/properties", label: "Portofolio Properti", short: "Properti", icon: Home },
  { href: "/projects", label: "Proyek & Pekerjaan", short: "Proyek", icon: BriefcaseBusiness },
  { href: "/quotations", label: "Penawaran", short: "Penawaran", icon: FileText },
  { href: "/invoices", label: "Tagihan", short: "Tagihan", icon: ReceiptText },
  { href: "/finance", label: "Keuangan", short: "Keuangan", icon: Wallet },
];

export function DashboardShell({
  organizationId,
  organizationName,
  role,
  children,
}: {
  organizationId: string;
  organizationName: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const basePath = `/dashboard/${organizationId}`;

  const isActive = (href: string) => href === ""
    ? pathname === basePath
    : pathname === `${basePath}${href}` || pathname.startsWith(`${basePath}${href}/`);

  const navLink = (item: typeof navigation[number], compact = false) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.label}
        href={`${basePath}${item.href}`}
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
        className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${active ? "bg-orange-500 text-white shadow-sm shadow-orange-950/10" : "text-neutral-600 hover:bg-orange-50 hover:text-orange-700"} ${compact ? "justify-center" : ""}`}
      >
        <Icon size={18} strokeWidth={1.9} />
        {!compact && <span>{item.label}</span>}
        {active && !compact && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f7f6] text-neutral-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-neutral-200 bg-white xl:flex">
        <Link href={basePath} className="flex h-[76px] items-center gap-3 border-b border-neutral-100 px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-orange-400"><Building2 size={21} /></span>
          <span><span className="block text-sm font-black tracking-[.12em]">DZAROZA</span><span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.2em] text-neutral-400">Property OS</span></span>
        </Link>
        <div className="px-4 pt-6">
          <p className="px-2 text-[10px] font-bold uppercase tracking-[.18em] text-neutral-400">Workspace aktif</p>
          <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="truncate text-sm font-bold text-neutral-900">{organizationName}</p>
            <p className="mt-1 text-xs text-neutral-500">Akses: {role.replaceAll("_", " ").toLowerCase()}</p>
          </div>
        </div>
        <nav aria-label="Navigasi utama" className="mt-7 flex-1 space-y-1 px-3">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-neutral-400">Menu utama</p>
          {navigation.map((item) => navLink(item))}
        </nav>
        <div className="border-t border-neutral-100 p-4">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900">
            <ArrowLeftRight size={17} /> Ganti organisasi
          </Link>
          <p className="px-3 pt-3 text-[10px] text-neutral-400">Dzaroza Property OS · v1</p>
        </div>
      </aside>

      <div className="xl:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 shadow-sm shadow-neutral-950/[.025] backdrop-blur">
          <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={basePath} aria-label="Beranda workspace" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-orange-400 xl:hidden"><Building2 size={18} /></Link>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-orange-600">Property management workspace</p>
                <p className="truncate text-sm font-bold text-neutral-900">{organizationName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 sm:inline-flex"><span className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />Workspace aktif</span>
              <button type="button" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Tutup menu" : "Buka menu"} aria-expanded={mobileOpen} className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 xl:hidden">
                {mobileOpen ? <X size={19} /> : <Menu size={19} />}
              </button>
            </div>
          </div>
          <nav aria-label="Navigasi tablet" className="hidden gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 md:flex xl:hidden">
            {navigation.map((item) => navLink(item, false))}
          </nav>
          {mobileOpen && <nav aria-label="Navigasi mobile" className="grid gap-1 border-t border-neutral-100 bg-white p-3 md:hidden">{navigation.map((item) => navLink(item))}<Link href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Ganti organisasi</Link></nav>}
        </header>
        <div className="mx-auto min-h-[calc(100vh-120px)] max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">{children}</div>
        <footer className="mx-auto max-w-[1600px] px-4 pb-7 text-xs text-neutral-400 sm:px-6 lg:px-8">Dzaroza Property OS · Sistem operasional dan managerial properti terintegrasi</footer>
      </div>
    </div>
  );
}
