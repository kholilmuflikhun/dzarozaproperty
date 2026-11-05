import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight, Building2, BriefcaseBusiness, FileText, ReceiptText, Wallet,
  Home, Clock3, Plus, ShieldCheck
} from "lucide-react";
import { prisma } from "@dzaroza/database";

const money = (value: number | { toString(): string }, currency = "IDR") =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));

const modules = [
  { href: "properties", eyebrow: "Property management", title: "Portofolio Properti", description: "Kelola kawasan, gedung, unit, fasilitas, dan aset dalam satu registry organisasi.", icon: Building2, accent: "bg-orange-50 text-orange-700" },
  { href: "projects", eyebrow: "Operasional", title: "Proyek & Pekerjaan", description: "Pantau pekerjaan, jadwal, nilai kontrak, progres, perubahan, dan dokumen.", icon: BriefcaseBusiness, accent: "bg-blue-50 text-blue-700" },
  { href: "quotations", eyebrow: "Komersial", title: "Penawaran & Anggaran", description: "Susun estimasi biaya, ruang lingkup layanan, dan penawaran kepada klien.", icon: FileText, accent: "bg-violet-50 text-violet-700" },
  { href: "invoices", eyebrow: "Penagihan", title: "Invoice & Termin", description: "Kelola tagihan, termin pembayaran, jatuh tempo, dan pelunasan.", icon: ReceiptText, accent: "bg-emerald-50 text-emerald-700" },
  { href: "finance", eyebrow: "Kontrol bisnis", title: "Keuangan", description: "Pantau penerimaan, pengeluaran, piutang, dan arus kas organisasi.", icon: Wallet, accent: "bg-sky-50 text-sky-700" },
];

export default async function OrganizationDashboard({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, currency: true, timezone: true },
  });
  if (!organization) notFound();

  const [propertyCount, unitCount, projectCount, activeProjectCount, invoiceCount, invoiceTotals, recentProjects] = await Promise.all([
    prisma.property.count({ where: { organizationId } }),
    prisma.propertyUnit.count({ where: { organizationId } }),
    prisma.project.count({ where: { organizationId } }),
    prisma.project.count({ where: { organizationId, status: { in: ["ACTIVE", "IN_PROGRESS"] } } }),
    prisma.invoice.count({ where: { organizationId } }),
    prisma.invoice.aggregate({ where: { organizationId, status: { not: "CANCELLED" } }, _sum: { total: true, paidAmount: true } }),
    prisma.project.findMany({
      where: { organizationId },
      select: { id: true, code: true, name: true, status: true, progress: true, contractValue: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);
  const billed = Number(invoiceTotals._sum.total ?? 0);
  const paid = Number(invoiceTotals._sum.paidAmount ?? 0);
  const outstanding = Math.max(0, billed - paid);
  const stats = [
    { label: "Properti terkelola", value: propertyCount, note: "Kawasan & bangunan", icon: Building2, color: "text-orange-600 bg-orange-50" },
    { label: "Unit terdaftar", value: unitCount, note: "Unit properti", icon: Home, color: "text-blue-700 bg-blue-50" },
    { label: "Total proyek", value: projectCount, note: `${activeProjectCount} proyek aktif`, icon: BriefcaseBusiness, color: "text-violet-700 bg-violet-50" },
    { label: "Invoice dibuat", value: invoiceCount, note: "Seluruh status tagihan", icon: ReceiptText, color: "text-emerald-700 bg-emerald-50" },
  ];

  return (
    <div className="space-y-7 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[26px] bg-[#0b1220] px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9 lg:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[36px] border-orange-500/10"/>
        <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-orange-500/10 blur-2xl"/>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-orange-300"><Building2 size={13}/> Property Management Workspace</span>
          <h1 className="mt-5 text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">Kelola properti lebih teratur. <span className="text-orange-400">Kinerja lebih terukur.</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Pusat kendali operasional untuk portofolio properti, proyek pemeliharaan, anggaran, dokumen, penagihan, dan keuangan organisasi.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/dashboard/${organization.id}/projects`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Plus size={16}/> Buka proyek & pekerjaan</Link>
            <Link href={`/dashboard/${organization.id}/properties`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"><Home size={16}/> Lihat portofolio</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-600">Ringkasan workspace</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">Ikhtisar operasional</h2></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500">Data organisasi aktif</span></div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((stat) => { const Icon = stat.icon; return <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-2"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}><Icon size={19}/></span><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ringkasan</span></div><p className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{stat.value.toLocaleString("id-ID")}</p><p className="mt-1 text-xs font-semibold text-slate-700 sm:text-sm">{stat.label}</p><p className="mt-1 text-[11px] text-slate-400">{stat.note}</p></article>; })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-orange-600">Kontrol penagihan</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">Ringkasan invoice</h2><p className="mt-1 text-xs text-slate-500">Nilai invoice yang tercatat pada organisasi.</p></div><ReceiptText size={21} className="text-orange-500"/></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-900 p-4 text-white"><p className="text-[11px] font-semibold text-slate-400">Total tagihan</p><p className="mt-2 break-words text-xl font-black sm:text-2xl">{money(billed, organization.currency)}</p></div>
            <div className="rounded-xl bg-orange-50 p-4"><p className="text-[11px] font-semibold text-orange-800/70">Sisa tagihan</p><p className="mt-2 break-words text-xl font-black text-orange-700 sm:text-2xl">{money(outstanding, organization.currency)}</p></div>
          </div>
          <div className="mt-4"><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-slate-600">Pembayaran diterima</span><span className="font-bold text-emerald-700">{billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 0}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${billed > 0 ? Math.min(100, Math.max(0, (paid / billed) * 100)) : 0}%` }}/></div><p className="mt-2 text-xs text-slate-500">Diterima: <strong className="text-slate-700">{money(paid, organization.currency)}</strong></p></div>
          <Link href={`/dashboard/${organization.id}/invoices`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-700 hover:text-orange-800">Buka invoice & termin <ArrowRight size={16}/></Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-orange-600">Aktivitas terbaru</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">Proyek diperbarui</h2></div><Clock3 size={20} className="text-slate-400"/></div>
          {recentProjects.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center"><BriefcaseBusiness className="mx-auto text-slate-300" size={27}/><p className="mt-2 text-sm font-semibold text-slate-700">Belum ada proyek</p><p className="mt-1 text-xs text-slate-400">Proyek terbaru akan muncul di sini.</p></div> : <ul className="mt-3 divide-y divide-slate-100">{recentProjects.map(project => <li key={project.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold text-orange-600">{project.code}</p><p className="mt-0.5 truncate text-sm font-bold text-slate-800">{project.name}</p><p className="mt-1 text-[11px] text-slate-400">{project.status.replaceAll("_"," ")}</p></div><span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{project.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{width:`${Math.max(0,Math.min(100,project.progress))}%`}}/></div></li>)}</ul>}
          <Link href={`/dashboard/${organization.id}/projects`} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-orange-700">Lihat semua proyek <ArrowRight size={16}/></Link>
        </div>
      </section>

      <section>
        <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-600">Akses cepat</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">Modul workspace</h2><p className="mt-1 text-sm text-slate-500">Pilih modul untuk melanjutkan pekerjaan.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {modules.map(module => { const Icon = module.icon; return <Link key={module.href} href={`/dashboard/${organization.id}/${module.href}`} className="group flex min-h-[185px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg hover:shadow-slate-950/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><div className="flex items-center justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${module.accent}`}><Icon size={21}/></span><ArrowRight size={17} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-600"/></div><p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{module.eyebrow}</p><h3 className="mt-1 text-base font-extrabold text-slate-950">{module.title}</h3><p className="mt-2 text-sm leading-5 text-slate-500">{module.description}</p></Link>; })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><ShieldCheck size={19}/></span><div><p className="text-sm font-bold text-slate-900">Workspace {organization.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">Data dibatasi berdasarkan organisasi aktif. Mata uang: {organization.currency} · Zona waktu: {organization.timezone}.</p></div></div><Link href="/dashboard" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Ganti organisasi <ArrowRight size={15}/></Link></section>
    </div>
  );
}
