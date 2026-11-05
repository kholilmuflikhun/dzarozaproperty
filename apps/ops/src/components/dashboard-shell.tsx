"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, Building2, BriefcaseBusiness, FileText, LayoutDashboard, Home,
  ReceiptText, Wallet, Menu, X, ChevronLeft, ChevronDown, ClipboardList,
  LifeBuoy, Bell, Search
} from "lucide-react";
import { useEffect, useState } from "react";

const groups = [
  { label: "Utama", items: [
    { href: "", label: "Dashboard", short: "Home", icon: LayoutDashboard },
    { href: "/properties", label: "Portofolio Properti", short: "Properti", icon: Home },
    { href: "/projects", label: "Proyek & Pekerjaan", short: "Proyek", icon: BriefcaseBusiness },
  ]},
  { label: "Operasional & Laporan", items: [
    { href: "/quotations", label: "Penawaran & Anggaran", short: "Penawaran", icon: FileText },
    { href: "/invoices", label: "Invoice & Termin", short: "Tagihan", icon: ReceiptText },
    { href: "/finance", label: "Keuangan", short: "Keuangan", icon: Wallet },
  ]},
];
const bottomItems = [
  { href: "", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properti", icon: Home },
  { href: "/projects", label: "Proyek", icon: BriefcaseBusiness },
  { href: "/invoices", label: "Tagihan", icon: ReceiptText },
  { href: "/finance", label: "Keuangan", icon: Wallet },
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
  const [collapsed, setCollapsed] = useState(false);
  const basePath = `/dashboard/${organizationId}`;
  const isActive = (href: string) => href === ""
    ? pathname === basePath
    : pathname === `${basePath}${href}` || pathname.startsWith(`${basePath}${href}/`);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const link = (item: typeof bottomItems[number] | (typeof groups)[number]["items"][number], compact = false) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={`${basePath}${item.href}`} aria-current={active ? "page" : undefined}
        title={compact ? item.label : undefined}
        className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${active ? "bg-orange-500 text-white shadow-sm shadow-orange-950/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"} ${compact ? "justify-center px-2" : ""}`}>
        <Icon size={19} strokeWidth={1.9} />
        {!compact && <span className="min-w-0 truncate">{item.label}</span>}
        {active && !compact && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
      </Link>
    );
  };

  const sidebar = (mobile = false) => (
    <>
      <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-white/[.07] px-5">
        <Link href={basePath} className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white"><Building2 size={22}/></span>
          <span className="min-w-0"><span className="block truncate text-sm font-black tracking-[.13em] text-white">DZAROZA</span><span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Property OS</span></span>
        </Link>
        {mobile
          ? <button type="button" onClick={() => setMobileOpen(false)} aria-label="Tutup navigasi" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={19}/></button>
          : <button type="button" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Perlebar sidebar" : "Perkecil sidebar"} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white">{collapsed ? <ChevronDown className="rotate-[-90deg]" size={18}/> : <ChevronLeft size={18}/>}</button>}
      </div>
      {!collapsed || mobile ? <div className="shrink-0 px-4 py-4">
        <p className="px-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace aktif</p>
        <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.04] p-3">
          <p className="truncate text-sm font-bold text-white">{organizationName}</p>
          <p className="mt-1 text-[11px] capitalize text-slate-400">Akses: {role.replaceAll("_", " ").toLowerCase()}</p>
        </div>
      </div> : null}
      <nav aria-label="Navigasi utama" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.map(group => <section key={group.label}>
          {(!collapsed || mobile) && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{group.label}</p>}
          <div className="space-y-1">{group.items.map(item => link(item, collapsed && !mobile))}</div>
        </section>)}
        <section>
          {(!collapsed || mobile) && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Pengaturan</p>}
          <Link href="/dashboard" title={collapsed && !mobile ? "Ganti organisasi" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white ${collapsed && !mobile ? "justify-center px-2" : ""}`}>
            <ArrowLeftRight size={18}/>{(!collapsed || mobile) && <span>Ganti organisasi</span>}
          </Link>
          <div className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 ${collapsed && !mobile ? "justify-center px-2" : ""}`}><LifeBuoy size={18}/>{(!collapsed || mobile) && <span>Bantuan & dukungan</span>}</div>
        </section>
      </nav>
      <div className="shrink-0 border-t border-white/[.07] p-4">
        <p className={`text-[10px] text-slate-600 ${collapsed && !mobile ? "text-center" : "px-2"}`}>{collapsed && !mobile ? "v1" : "Dzaroza Property OS · Workspace"}</p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-800 bg-[#0b1220] transition-[width] duration-200 xl:flex ${collapsed ? "w-[84px]" : "w-[276px]"}`}>
        {sidebar(false)}
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-50 xl:hidden">
        <button aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"/>
        <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-slate-800 bg-[#0b1220] shadow-2xl">{sidebar(true)}</aside>
      </div>}

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "xl:pl-[84px]" : "xl:pl-[276px]"}`}>
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-950/[.025] backdrop-blur">
          <div className="mx-auto flex min-h-[70px] max-w-[1680px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} aria-label="Buka navigasi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 xl:hidden"><Menu size={20}/></button>
              <div className="min-w-0"><p className="hidden text-[10px] font-bold uppercase tracking-[.16em] text-orange-600 sm:block">Property management workspace</p><p className="truncate text-sm font-bold text-slate-900">{organizationName}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Workspace aktif</span>
              <button type="button" aria-label="Pencarian (segera hadir)" title="Pencarian global segera hadir" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 sm:flex"><Search size={18}/></button>
              <button type="button" aria-label="Notifikasi (segera hadir)" title="Notifikasi segera hadir" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><Bell size={18}/></button>
            </div>
          </div>
          <nav aria-label="Navigasi tablet" className="hidden gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:flex xl:hidden">
            {bottomItems.map(item => link(item))}
          </nav>
        </header>
        <div className="mx-auto min-h-[calc(100vh-130px)] max-w-[1680px] px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24 lg:px-8 lg:py-8 xl:pb-8">{children}</div>
        <footer className="mx-auto hidden max-w-[1680px] px-4 pb-7 text-xs text-slate-400 sm:px-6 lg:px-8 xl:block">Dzaroza Property OS · Sistem operasional dan managerial properti terintegrasi</footer>
      </div>
      <nav aria-label="Navigasi cepat mobile" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(15,23,42,.06)] backdrop-blur md:hidden">
        {bottomItems.map(item => {
          const Icon = item.icon; const active = isActive(item.href);
          return <Link key={item.href} href={`${basePath}${item.href}`} aria-current={active ? "page" : undefined} className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${active ? "text-orange-600" : "text-slate-500"}`}>
            <span className={`flex h-8 w-10 items-center justify-center rounded-xl ${active ? "bg-orange-50" : ""}`}><Icon size={19}/></span><span className="max-w-full truncate">{item.label}</span>
          </Link>;
        })}
      </nav>
    </div>
  );
}
