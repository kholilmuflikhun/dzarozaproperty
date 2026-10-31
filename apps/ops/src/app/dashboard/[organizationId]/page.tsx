import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@dzaroza/database";
import { requireTenantContext } from "@/lib/tenant";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

const modules = [
  { href: "quotations", eyebrow: "Sales · Phase 2", title: "Penawaran & Persetujuan", description: "Buat quotation, kirim link persetujuan klien, dan konversikan penawaran yang disetujui menjadi proyek." },
  { href: "invoices", eyebrow: "Finance · Phase 2", title: "Invoice & Pembayaran", description: "Terbitkan invoice, kirim PDF, unduh dokumen, dan catat pembayaran manual atau melalui Midtrans." },
  { href: "finance", eyebrow: "Finance · Overview", title: "Dashboard Keuangan", description: "Pantau penerimaan, pengeluaran, arus kas bersih, piutang dan tren enam bulan." },
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

  return <main className="min-h-screen bg-slate-50 px-5 py-8 md:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="text-sm font-semibold text-blue-700">← Semua organisasi</Link>
      <header className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Dzaroza Property OS</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{organization.name}</h1>
        <p className="mt-2 text-sm text-slate-600">Role Anda: {membership.role}. Seluruh modul menggunakan akses dan data tenant organisasi ini.</p>
      </header>
      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Informasi workspace</h2>
        <p className="mt-2 text-sm text-slate-600">Tenant context: {organization.id}</p>
        <p className="mt-1 text-xs text-slate-500">Mata uang: {organization.currency} · Zona waktu: {organization.timezone}</p>
      </section>
      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => <Link key={module.href} href={`/dashboard/${organization.id}/${module.href}`} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">{module.eyebrow}</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">{module.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
          <span className="mt-5 inline-flex text-sm font-semibold text-blue-700 group-hover:text-blue-800">Buka modul →</span>
        </Link>)}
      </section>
    </div>
  </main>;
}
