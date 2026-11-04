import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  FileText,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@dzaroza/database";
import { requireTenantContext } from "@/lib/tenant";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

type WorkspaceModule = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
};

export default async function OrganizationDashboard({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
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

  const modules: WorkspaceModule[] = [
    {
      href: "quotations",
      eyebrow: "Penjualan",
      title: "Penawaran & Persetujuan",
      description:
        "Susun penawaran harga, pantau status persetujuan klien, dan tindak lanjuti proses penjualan.",
      action: "Kelola penawaran",
      icon: FileText,
    },
    {
      href: "invoices",
      eyebrow: "Keuangan",
      title: "Invoice & Pembayaran",
      description:
        "Terbitkan tagihan, pantau pembayaran, dan kelola dokumen transaksi dalam satu alur.",
      action: "Kelola invoice",
      icon: ReceiptText,
    },
    {
      href: "finance",
      eyebrow: "Analitik",
      title: "Dashboard Keuangan",
      description:
        "Tinjau penerimaan, pengeluaran, arus kas, piutang, dan tren keuangan organisasi.",
      action: "Lihat ringkasan",
      icon: ChartNoAxesCombined,
    },
  ];

  const navigation = [
    { label: "Ringkasan", href: `/dashboard/${organization.id}`, icon: LayoutDashboard, active: true },
    ...modules.map((module) => ({
      label: module.title,
      href: `/dashboard/${organization.id}/${module.href}`,
      icon: module.icon,
      active: false,
    })),
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-7 lg:flex lg:flex-col">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-700 text-white">
              <Building2 size={21} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight">DZAROZA</span>
              <span className="block text-xs text-slate-500">Property Operating System</span>
            </span>
          </Link>

          <div className="mt-10">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Workspace
            </p>
            <nav aria-label="Navigasi workspace" className="mt-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      item.active
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <ShieldCheck size={17} aria-hidden="true" />
              Data terlindungi
            </div>
            <p className="mt-2 text-xs leading-5 text-blue-800/80">
              Akses workspace dibatasi berdasarkan keanggotaan organisasi.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="min-w-0">
                <Link href="/dashboard" className="text-xs font-medium text-slate-500 hover:text-blue-700">
                  Semua organisasi
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="truncate text-base font-bold tracking-tight md:text-lg">
                    {organization.name}
                  </h1>
                  <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
                    Workspace aktif
                  </span>
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {membership.role.replaceAll("_", " ")}
              </div>
            </div>
            <nav aria-label="Navigasi mobile" className="mx-auto mt-4 flex max-w-6xl gap-2 overflow-x-auto pb-0.5 lg:hidden">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    item.active
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-sm md:px-9 md:py-9">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                    Dzaroza Property OS
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                    Kelola bisnis properti dengan lebih terarah.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                    Semua alur kerja organisasi dalam satu workspace. Pilih modul untuk mulai
                    mengelola aktivitas bisnis Anda.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <ShieldCheck size={19} className="text-emerald-300" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-white">Akses terverifikasi</p>
                    <p className="mt-0.5 text-[11px] text-slate-300">Tenant workspace</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
                    Pusat aktivitas
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                    Modul workspace
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Akses fitur sesuai kebutuhan pekerjaan Anda.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  {modules.length} modul tersedia
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link
                      key={module.href}
                      href={`/dashboard/${organization.id}/${module.href}`}
                      className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white">
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {module.eyebrow}
                        </span>
                      </div>
                      <h3 className="mt-5 text-base font-bold text-slate-950">{module.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
                      <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-semibold text-blue-700">
                        {module.action}
                        <ChevronRight size={16} className="transition group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Building2 size={17} className="text-blue-700" aria-hidden="true" />
                  Pengaturan organisasi
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Mata uang: <span className="font-semibold text-slate-700">{organization.currency}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Zona waktu: <span className="font-semibold text-slate-700">{organization.timezone}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShieldCheck size={17} className="text-emerald-600" aria-hidden="true" />
                  Privasi & akses
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Data yang ditampilkan dibatasi untuk organisasi ini. Hak akses setiap tindakan
                  mengikuti peran akun Anda.
                </p>
                <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">
                  Ganti organisasi <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </section>

            <footer className="mt-10 border-t border-slate-200 py-5 text-xs text-slate-400">
              Dzaroza Property OS · Workspace operasional properti
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
