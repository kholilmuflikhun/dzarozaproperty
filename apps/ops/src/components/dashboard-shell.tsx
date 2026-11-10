import Link from "next/link";
import { ArrowUpRight, Building2, FileText, FolderOpen, LayoutDashboard, ReceiptText, Wallet } from "lucide-react";

const navigation = [
  { href: "", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/quotations", label: "Penawaran", icon: FileText },
  { href: "/invoices", label: "Invoice", icon: ReceiptText },
  { href: "/documents", label: "Dokumen", icon: FolderOpen },
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
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white"><Building2 size={21} /></div>
          <div><p className="text-sm font-bold tracking-tight">DZAROZA</p><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">Property OS</p></div>
        </div>
        <div className="px-4 pt-6">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold">{organizationName}</p>
            <p className="mt-1 text-xs text-slate-500">Role: {role}</p>
          </div>
        </div>
        <nav aria-label="Navigasi utama" className="mt-7 flex-1 space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <Link key={item.label} href={`/dashboard/${organizationId}${item.href}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${item.href === "" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
              <Icon size={18} strokeWidth={1.8} />{item.label}
            </Link>;
          })}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <Link href="/dashboard" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900">
            Ganti organisasi <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="min-w-0"><p className="text-xs font-medium text-slate-400">Workspace aktif</p><p className="truncate text-sm font-semibold">{organizationName}</p></div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Workspace aman</div>
          </div>
          <nav aria-label="Navigasi mobile" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
            {navigation.map((item) => <Link key={item.label} href={`/dashboard/${organizationId}${item.href}`} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">{item.label}</Link>)}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-7 text-xs text-slate-400 sm:px-6 lg:px-8">Dzaroza Property OS · Sistem operasional properti yang terintegrasi</footer>
      </div>
    </div>
  );
}
