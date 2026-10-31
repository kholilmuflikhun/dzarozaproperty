import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";

function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const now = new Date();
    const currentMonth = startOfMonth(now);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [invoiceTotals, paymentTotals, expenseTotals, outstanding, monthlyPayments, monthlyExpenses] = await Promise.all([
      prisma.invoice.aggregate({ where: { organizationId, createdAt: { gte: currentMonth }, status: { not: "VOID" } }, _sum: { total: true, paidAmount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.aggregate({ where: { organizationId, invoiceId: { not: null }, status: "SETTLEMENT", paidAt: { gte: currentMonth } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.expense.aggregate({ where: { organizationId, incurredAt: { gte: currentMonth } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.invoice.aggregate({ where: { organizationId, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } }, _sum: { total: true, paidAmount: true }, _count: { _all: true } }),
      prisma.paymentTransaction.findMany({ where: { organizationId, invoiceId: { not: null }, status: "SETTLEMENT", paidAt: { gte: sixMonthsAgo } }, select: { amount: true, paidAt: true } }),
      prisma.expense.findMany({ where: { organizationId, incurredAt: { gte: sixMonthsAgo } }, select: { amount: true, incurredAt: true } }),
    ]);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { month: monthKey(date), income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) };
    });
    const byMonth = new Map(months.map((month) => [month.month, month]));
    for (const payment of monthlyPayments) {
      if (!payment.paidAt) continue;
      const bucket = byMonth.get(monthKey(payment.paidAt));
      if (bucket) bucket.income = bucket.income.plus(payment.amount);
    }
    for (const expense of monthlyExpenses) {
      const bucket = byMonth.get(monthKey(expense.incurredAt));
      if (bucket) bucket.expense = bucket.expense.plus(expense.amount);
    }
    const income = paymentTotals._sum.amount ?? new Prisma.Decimal(0);
    const expenses = expenseTotals._sum.amount ?? new Prisma.Decimal(0);
    const receivable = (outstanding._sum.total ?? new Prisma.Decimal(0)).minus(outstanding._sum.paidAmount ?? new Prisma.Decimal(0));
    return NextResponse.json({
      period: { from: currentMonth.toISOString(), to: now.toISOString(), currency: "IDR" },
      currentMonth: {
        invoiced: (invoiceTotals._sum.total ?? new Prisma.Decimal(0)).toString(),
        collected: income.toString(), expenses: expenses.toString(),
        netCashFlow: income.minus(expenses).toString(),
        invoiceCount: invoiceTotals._count._all, paymentCount: paymentTotals._count._all,
        expenseCount: expenseTotals._count._all,
      },
      receivables: { outstanding: receivable.toString(), invoiceCount: outstanding._count._all },
      trend: months.map((month) => ({
        month: month.month, income: month.income.toString(), expenses: month.expense.toString(),
        netCashFlow: month.income.minus(month.expense).toString(),
      })),
      notes: ["Pendapatan dihitung dari pembayaran invoice berstatus SETTLEMENT, bukan nilai invoice yang baru diterbitkan.", "Pengeluaran dihitung berdasarkan tanggal incurredAt.", "Pembayaran langganan platform tidak dimasukkan ke laporan keuangan operasional tenant."],
    });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
