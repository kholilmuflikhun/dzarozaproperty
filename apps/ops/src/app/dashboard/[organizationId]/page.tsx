import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FileText, ReceiptText, Wallet } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@dzaroza/database";
import { requireTenantContext } from "@/lib/tenant";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { DashboardShell } from "@/components/dashboard-shell";

const modules = [
  { href: "projects", eyebrow: "Operasional", title: "Manajemen Proyek", description: "Kelola workspace proyek, rincian pekerjaan, termin pembayaran, progres, dan tujuh dokumen otomatis.", icon: BriefcaseBusiness, accent: "bg-amber-50 text-amber-700" },
  { href: "quotations", eyebrow: "Penjualan", title: "Penawaran & Persetujuan", description: "Susun penawaran, kirim tautan persetujuan kepada klien, dan konversikan penawaran yang disetujui menjadi proyek.", icon: FileText, accent: "bg-orange-50 text-orange-600" },
  { href: "invoices", eyebrow: "Penagihan", title: "Invoice & Pembayaran", description: "Terbitkan invoice, kirim dokumen PDF, dan pantau pembayaran manual maupun Midtrans.", icon: ReceiptText, accent: "bg-violet-50 text-violet-700" },
  { href: "finance", eyebrow: "Kontrol bisnis", title: "Dashboard Keuangan", description: "Pantau penerimaan, pengeluaran, arus kas bersih, piutang, dan tren keuangan.", icon: Wallet, accent: "bg-emerald-50 text-emerald-700" },
];

export default async function OrganizationDashboard({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  let membership;
  try {
    membership = await requireTenantContext(organizationId);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
  const organization = await prisma.organization.findUnique({
    where: { id: membership.organizationId },
    select: { id: true, name: true, currency: true, timezone: true },
  });
  if (!organization) notFound();

  return (
    <DashboardShell organizationId={organization.id} organizationName={organization.name} role={membership.role}>
      <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Dzaroza Property OS</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Selamat datang di workspace {organization.name}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Kelola aktivitas properti, hubungan klien, penawaran, dan keuangan bisnis dari satu tempat.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Role: {membership.role}</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Mata uang: {organization.currency}</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Zona waktu: {organization.timezone}</span>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">Pusat operasional</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Modul workspace</h2><p className="mt-1 text-sm text-slate-500">Pilih area kerja untuk melanjutkan aktivitas.</p></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return <Link key={module.href} href={`/dashboard/${organization.id}/${module.href}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${module.accent}`}><Icon size={21} strokeWidth={1.8} /></div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">{module.eyebrow}</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">{module.title}</h3>
              <p className="mt-2 min-h-14 text-sm leading-6 text-slate-500">{module.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-600">Buka modul <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
            </Link>;
          })}
        </div>
      </section>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="font-semibold text-slate-950">Informasi workspace</h2><p className="mt-1 text-sm text-slate-500">Detail organisasi dan konteks akses Anda.</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Tenant aktif</span>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <div><dt className="text-xs text-slate-400">Organisasi</dt><dd className="mt-1 break-all text-sm font-medium text-slate-800">{organization.name}</dd></div>
          <div><dt className="text-xs text-slate-400">Mata uang</dt><dd className="mt-1 text-sm font-medium text-slate-800">{organization.currency}</dd></div>
          <div><dt className="text-xs text-slate-400">Zona waktu</dt><dd className="mt-1 text-sm font-medium text-slate-800">{organization.timezone}</dd></div>
        </dl>
      </section>
    </DashboardShell>
  );
}
