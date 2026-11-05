"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Building2, BriefcaseBusiness, FileText, LayoutDashboard, ReceiptText, Wallet } from "lucide-react";

const navigation = [
  { href: "", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/projects", label: "Proyek", icon: BriefcaseBusiness },
  { href: "/quotations", label: "Penawaran", icon: FileText },
  { href: "/invoices", label: "Invoice", icon: ReceiptText },
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
  const basePath = `/dashboard/${organizationId}`;

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#111827] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white"><Building2 size={21} /></div>
          <div><p className="text-sm font-extrabold tracking-tight">DZAROZA</p><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">Property OS</p></div>
        </div>
        <div className="px-4 pt-6">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace</p>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="truncate text-sm font-semibold">{organizationName}</p>
            <p className="mt-1 text-xs text-slate-400">Peran: {role}</p>
          </div>
        </div>
        <nav aria-label="Navigasi utama" className="mt-7 flex-1 space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const href = `${basePath}${item.href}`;
            const active = item.href === "" ? pathname === basePath : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={item.label} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-orange-500 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={18} strokeWidth={1.8} />{item.label}
            </Link>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link href="/dashboard" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white">
            Ganti organisasi <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-950/[.03] backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white lg:hidden"><Building2 size={19}/></div>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-orange-600">Workspace aktif</p><p className="truncate text-sm font-bold text-slate-900">{organizationName}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Aman</div>
          </div>
          <nav aria-label="Navigasi mobile dan tablet" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
            {navigation.map((item) => {
              const href = `${basePath}${item.href}`;
              const active = item.href === "" ? pathname === basePath : pathname === href || pathname.startsWith(`${href}/`);
              return <Link key={item.label} href={href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${active ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-orange-50 hover:text-orange-700"}`}>{item.label}</Link>;
            })}
          </nav>
        </header>
        <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">{children}</main>
        <footer className="mx-auto max-w-[1600px] px-4 pb-7 text-xs text-slate-400 sm:px-6 lg:px-8">Dzaroza Property OS · Sistem operasional dan managerial properti terintegrasi</footer>
      </div>
    </div>
  );
}
