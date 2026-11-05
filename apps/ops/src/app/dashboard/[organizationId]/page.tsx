import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FileText, ReceiptText, Wallet, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@dzaroza/database";

const modules = [
  { href: "properties", eyebrow: "Property management", title: "Portofolio Properti", description: "Kelola kawasan, gedung, unit, dan aset properti dalam satu registry organisasi.", icon: Building2, accent: "bg-orange-50 text-orange-700" },
  { href: "projects", eyebrow: "Operasional", title: "Proyek & Pekerjaan", description: "Kelola pekerjaan properti, jadwal, nilai kontrak, progres, perubahan pekerjaan, dan dokumen.", icon: BriefcaseBusiness, accent: "bg-orange-50 text-orange-700" },
  { href: "quotations", eyebrow: "Komersial", title: "Penawaran", description: "Susun penawaran layanan, kirim persetujuan, dan lanjutkan pekerjaan dari penawaran yang diterima.", icon: FileText, accent: "bg-neutral-100 text-neutral-800" },
  { href: "invoices", eyebrow: "Keuangan", title: "Tagihan & Pembayaran", description: "Kelola invoice, pembayaran, status pelunasan, dan dokumen penagihan.", icon: ReceiptText, accent: "bg-orange-50 text-orange-700" },
  { href: "finance", eyebrow: "Kontrol bisnis", title: "Keuangan & Arus Kas", description: "Pantau penerimaan, pengeluaran, piutang, dan ringkasan keuangan organisasi.", icon: Wallet, accent: "bg-neutral-100 text-neutral-800" },
];

const roadmap = [
  ["Portofolio properti", "Data gedung, kawasan, fasilitas, dan unit"],
  ["Penghuni & pemilik", "Database penghuni, pemilik, dan relasi"],
  ["Kontrak & tagihan rutin", "Masa kontrak, jatuh tempo, dan pengingat"],
  ["Pemeliharaan & keluhan", "Work order, inspeksi, SLA, dan riwayat"],
  ["Laporan manajemen", "Operasional, okupansi, keuangan, dan kinerja"],
];

export default async function OrganizationDashboard({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, currency: true, timezone: true },
  });
  if (!organization) notFound();

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] bg-neutral-950 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9 lg:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[36px] border-orange-500/10" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-orange-500/10 blur-2xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-orange-300"><Building2 size={13}/> Property Management Workspace</span>
          <h1 className="mt-5 text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">Kelola properti lebih teratur. <span className="text-orange-400">Keputusan lebih terukur.</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">Satu workspace untuk mengelola pekerjaan, klien, dokumen, tagihan, dan keuangan. Fondasi operasional yang dapat dikembangkan menjadi sistem managerial property multi-organisasi.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/dashboard/${organization.id}/projects`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950">Buka workspace proyek <ArrowRight size={16}/></Link>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-neutral-200"><ShieldCheck size={16} className="text-orange-300"/> Tenant workspace aktif</span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-orange-600">Pusat operasional</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">Modul workspace</h2><p className="mt-1 text-sm text-neutral-500">Akses modul yang tersedia pada organisasi ini.</p></div>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">{modules.length} modul tersedia</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return <Link key={module.href} href={`/dashboard/${organization.id}/${module.href}`} className="group flex min-h-[220px] flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg hover:shadow-neutral-950/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
              <div className="flex items-center justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${module.accent}`}><Icon size={21} strokeWidth={1.9}/></span><ArrowRight size={17} className="text-neutral-300 transition group-hover:translate-x-1 group-hover:text-orange-600"/></div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-neutral-400">{module.eyebrow}</p>
              <h3 className="mt-1.5 text-base font-extrabold text-neutral-950">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{module.description}</p>
            </Link>;
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-orange-600">Arah pengembangan</p><h2 className="mt-1 text-lg font-extrabold text-neutral-950">Ekosistem Managerial Property</h2><p className="mt-1 text-sm text-neutral-500">Kapabilitas berikutnya akan ditambahkan bertahap pada fondasi yang sama.</p></div><Sparkles className="shrink-0 text-orange-500" size={21}/></div>
          <div className="mt-5 divide-y divide-neutral-100">
            {roadmap.map(([title,description],index)=><div key={title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-extrabold text-orange-700">{String(index+1).padStart(2,"0")}</span><div><p className="text-sm font-bold text-neutral-800">{title}</p><p className="mt-0.5 text-xs leading-5 text-neutral-500">{description}</p></div></div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-orange-600">Workspace Anda</p>
          <h2 className="mt-1 text-lg font-extrabold text-neutral-950">Informasi organisasi</h2>
          <dl className="mt-5 space-y-4">
            <div className="border-b border-neutral-100 pb-3"><dt className="text-xs text-neutral-400">Nama organisasi</dt><dd className="mt-1 break-words text-sm font-bold text-neutral-900">{organization.name}</dd></div>
            <div className="border-b border-neutral-100 pb-3"><dt className="text-xs text-neutral-400">Mata uang</dt><dd className="mt-1 text-sm font-semibold text-neutral-800">{organization.currency}</dd></div>
            <div><dt className="text-xs text-neutral-400">Zona waktu</dt><dd className="mt-1 text-sm font-semibold text-neutral-800">{organization.timezone}</dd></div>
          </dl>
          <div className="mt-6 rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-500">Data antarorganisasi dipisahkan melalui kontrol akses tenant. Fitur yang belum tersedia tidak ditampilkan sebagai fitur aktif.</div>
        </div>
      </section>
    </div>
  );
}
