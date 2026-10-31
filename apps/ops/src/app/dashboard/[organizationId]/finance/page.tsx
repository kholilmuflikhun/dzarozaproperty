import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma, prisma } from "@dzaroza/database";
import { requireTenantContext } from "@/lib/tenant";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const money = (value: Prisma.Decimal | number | string) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(Number(value));
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
};

export default async function FinanceDashboard({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  let membership;
  try { membership = await requireTenantContext(organizationId); }
  catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
  const organization = await prisma.organization.findUnique({
    where: { id: membership.organizationId }, select: { id: true, name: true, currency: true },
  });
  if (!organization) notFound();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [invoices, collections, expenses, receivables, paymentsTrend, expensesTrend] = await Promise.all([
    prisma.invoice.aggregate({
      where: { organizationId, createdAt: { gte: monthStart }, status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] } },
      _sum: { total: true }, _count: { _all: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { organizationId, invoiceId: { not: null }, status: "SETTLEMENT", paidAt: { gte: monthStart } },
      _sum: { amount: true }, _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: { organizationId, incurredAt: { gte: monthStart } }, _sum: { amount: true }, _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: { organizationId, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { total: true, paidAmount: true }, _count: { _all: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { organizationId, invoiceId: { not: null }, status: "SETTLEMENT", paidAt: { gte: sixMonthsStart } },
      select: { amount: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: { organizationId, incurredAt: { gte: sixMonthsStart } },
      select: { amount: true, incurredAt: true },
    }),
  ]);
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: monthLabel(key), income: 0, expense: 0 };
  });
  const lookup = new Map(trend.map((entry) => [entry.key, entry]));
  for (const row of paymentsTrend) if (row.paidAt) {
    const key = `${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = lookup.get(key); if (bucket) bucket.income += Number(row.amount);
  }
  for (const row of expensesTrend) {
    const key = `${row.incurredAt.getFullYear()}-${String(row.incurredAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = lookup.get(key); if (bucket) bucket.expense += Number(row.amount);
  }
  const collected = collections._sum.amount ?? new Prisma.Decimal(0);
  const spent = expenses._sum.amount ?? new Prisma.Decimal(0);
  const receivable = (receivables._sum.total ?? new Prisma.Decimal(0)).minus(receivables._sum.paidAmount ?? new Prisma.Decimal(0));
  const maxBar = Math.max(1, ...trend.flatMap((row) => [row.income, row.expense]));
  const cards = [
    { label: "Invoice diterbitkan", value: money(invoices._sum.total ?? 0), note: `${invoices._count._all} invoice bulan ini` },
    { label: "Pembayaran diterima", value: money(collected), note: `${collections._count._all} transaksi settlement` },
    { label: "Pengeluaran", value: money(spent), note: `${expenses._count._all} catatan biaya` },
    { label: "Arus kas bersih", value: money(collected.minus(spent)), note: "Penerimaan dikurangi pengeluaran" },
  ];
  return <main className="min-h-screen px-5 py-8 md:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href={`/dashboard/${organizationId}`} className="text-sm font-semibold text-blue-700">← Kembali ke workspace</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Dzaroza Property OS · Finance</p><h1 className="mt-2 text-3xl font-bold">Dashboard Keuangan</h1><p className="mt-1 text-sm text-slate-600">{organization.name} · {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(now)}</p></div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Role: {membership.role}</span>
      </header>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{card.label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{card.value}</p><p className="mt-2 text-xs text-slate-500">{card.note}</p></article>)}
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Tren arus kas</h2><p className="mt-1 text-xs text-slate-500">Enam bulan terakhir · IDR</p></div><div className="flex gap-3 text-xs"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-600"/>Penerimaan</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500"/>Pengeluaran</span></div></div>
          <div className="mt-6 grid grid-cols-6 gap-3">
            {trend.map((row) => <div key={row.key} className="min-w-0 text-center">
              <div className="flex h-40 items-end justify-center gap-1 rounded-lg bg-slate-50 px-1 pb-2 pt-3">
                <div title={`Penerimaan ${money(row.income)}`} className="w-3 rounded-t bg-blue-600" style={{ height: `${Math.max(row.income > 0 ? 4 : 0, row.income / maxBar * 100)}%` }}/>
                <div title={`Pengeluaran ${money(row.expense)}`} className="w-3 rounded-t bg-orange-500" style={{ height: `${Math.max(row.expense > 0 ? 4 : 0, row.expense / maxBar * 100)}%` }}/>
              </div><p className="mt-2 truncate text-[11px] font-medium text-slate-500">{row.label}</p>
            </div>)}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Piutang berjalan</h2><p className="mt-1 text-xs text-slate-500">Invoice terbit yang belum lunas</p>
          <p className="mt-5 text-3xl font-bold">{money(receivable)}</p><p className="mt-2 text-sm text-slate-500">{receivables._count._all} invoice belum lunas</p>
          <div className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">Catat pembayaran setelah dana benar-benar diterima. Pembayaran parsial akan memperbarui saldo invoice secara otomatis.</div>
        </article>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        <h2 className="font-semibold text-slate-900">Basis perhitungan</h2>
        <p className="mt-2">Penerimaan dihitung dari pembayaran invoice berstatus SETTLEMENT, bukan sekadar invoice yang diterbitkan. Pengeluaran mengikuti tanggal biaya dicatat. Pembayaran langganan platform tidak masuk ke arus kas operasional organisasi.</p>
      </section>
    </div>
  </main>;
}
