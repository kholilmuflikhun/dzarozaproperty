"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: string;
  paidAmount: string;
  dueAt: string | null;
  createdAt: string;
  project?: { id: string; code: string; name: string; client?: { name: string } } | null;
  quotation?: { id: string; number: string } | null;
};

const money = (value: string | number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(Number(value));
const statusLabel: Record<string, string> = {
  DRAFT: "Draft", SENT: "Terbit", PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas", OVERDUE: "Jatuh tempo", VOID: "Dibatalkan",
};

export default function InvoiceManagementPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [payments, setPayments] = useState<Record<string, string>>({});

  const endpoint = `/api/organizations/${encodeURIComponent(organizationId)}/invoices`;

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Gagal memuat invoice.");
      setInvoices(payload.invoices ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat invoice.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("create");
    setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: projectId.trim(),
          items: [{ description: description.trim(), quantity: Number(quantity), unitPrice: Number(unitPrice) }],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Invoice gagal dibuat.");
      setNotice(`Invoice ${payload.invoice.number} berhasil dibuat sebagai Draft.`);
      setProjectId(""); setDescription(""); setQuantity("1"); setUnitPrice("");
      await loadInvoices();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invoice gagal dibuat.");
    } finally {
      setWorking(null);
    }
  }

  async function runInvoiceAction(invoice: Invoice, action: "issue" | "send" | "pdf" | "checkout" | "payment") {
    setWorking(`${invoice.id}:${action}`); setError(""); setNotice("");
    try {
      if (action === "pdf") {
        const response = await fetch(`${endpoint}/${invoice.id}/pdf`);
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.error ?? "PDF invoice gagal dibuat.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = `${invoice.number}.pdf`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        URL.revokeObjectURL(url);
        setNotice("PDF invoice berhasil disiapkan.");
      } else if (action === "checkout") {
        const response = await fetch(`${endpoint}/${invoice.id}/checkout`, { method: "POST" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Checkout gagal dibuat.");
        if (payload.redirectUrl) window.location.assign(payload.redirectUrl);
        else throw new Error("URL pembayaran tidak tersedia.");
      } else if (action === "payment") {
        const amount = Number(payments[invoice.id]);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Masukkan nominal pembayaran yang valid.");
        const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/payments`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ invoiceId: invoice.id, amount }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Pembayaran gagal dicatat.");
        setNotice(`Pembayaran ${money(amount)} berhasil dicatat.`);
        setPayments((current) => ({ ...current, [invoice.id]: "" }));
        await loadInvoices();
      } else if (action === "issue") {
        const response = await fetch(`${endpoint}/${invoice.id}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "issue" }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Invoice gagal diterbitkan.");
        setNotice(`Invoice ${invoice.number} berhasil diterbitkan.`);
        await loadInvoices();
      } else {
        const response = await fetch(`${endpoint}/${invoice.id}/send`, { method: "POST" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Email invoice gagal dikirim.");
        setNotice(payload.message ?? "Invoice berhasil dikirim ke klien.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi invoice gagal.");
    } finally {
      setWorking(null);
    }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-8 md:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href={`/dashboard/${organizationId}`} className="text-sm font-semibold text-blue-700">← Kembali ke workspace</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Dzaroza Property OS · Finance</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Manajemen Invoice</h1><p className="mt-1 text-sm text-slate-600">Buat, terbitkan, kirim, unduh PDF dan catat pembayaran invoice.</p></div>
        <Link href={`/dashboard/${organizationId}/finance`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Dashboard Keuangan</Link>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Buat invoice manual</h2>
        <p className="mt-1 text-sm text-slate-500">Invoice dibuat sebagai Draft. Gunakan ID proyek yang sudah terdaftar di organisasi ini.</p>
        <form onSubmit={createInvoice} className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Project ID
            <input required value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="ID proyek" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <label className="text-sm font-medium text-slate-700">Deskripsi layanan
            <input required minLength={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Jasa manajemen properti" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <label className="text-sm font-medium text-slate-700">Kuantitas
            <input required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <label className="text-sm font-medium text-slate-700">Harga satuan (IDR)
            <input required type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="1500000" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <div className="md:col-span-2"><button disabled={working === "create"} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{working === "create" ? "Membuat…" : "Buat Draft Invoice"}</button></div>
        </form>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Daftar invoice</h2><button onClick={() => void loadInvoices()} className="text-sm font-semibold text-blue-700">Muat ulang</button></div>
        {loading ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Memuat invoice…</p> : invoices.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Belum ada invoice di organisasi ini.</p> : <div className="grid gap-4">
          {invoices.map((invoice) => <article key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{invoice.number}</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{invoice.project?.name ?? invoice.quotation?.number ?? "Invoice layanan"}</h3><p className="mt-1 text-xs text-slate-500">{invoice.project?.client?.name ?? "Klien"} · {new Date(invoice.createdAt).toLocaleDateString("id-ID")}</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusLabel[invoice.status] ?? invoice.status}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-slate-500">Total invoice</p><p className="mt-1 font-bold tabular-nums">{money(invoice.total)}</p></div>
              <div><p className="text-xs text-slate-500">Sudah dibayar</p><p className="mt-1 font-semibold tabular-nums">{money(invoice.paidAmount)}</p></div>
              <div><p className="text-xs text-slate-500">Sisa tagihan</p><p className="mt-1 font-semibold tabular-nums">{money(Number(invoice.total) - Number(invoice.paidAmount))}</p></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {invoice.status === "DRAFT" && <button disabled={working === `${invoice.id}:issue`} onClick={() => void runInvoiceAction(invoice, "issue")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Terbitkan</button>}
              {["SENT", "PARTIALLY_PAID", "OVERDUE", "PAID"].includes(invoice.status) && <button disabled={working === `${invoice.id}:send`} onClick={() => void runInvoiceAction(invoice, "send")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Kirim email PDF</button>}
              <button disabled={working === `${invoice.id}:pdf`} onClick={() => void runInvoiceAction(invoice, "pdf")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Unduh PDF</button>
              {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && <button disabled={working === `${invoice.id}:checkout`} onClick={() => void runInvoiceAction(invoice, "checkout")} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">Bayar via Midtrans</button>}
            </div>
            {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <label className="min-w-48 flex-1 text-xs font-medium text-slate-600">Catat pembayaran manual (IDR)
                <input type="number" min="0.01" step="0.01" value={payments[invoice.id] ?? ""} onChange={(event) => setPayments((current) => ({ ...current, [invoice.id]: event.target.value }))} placeholder="Nominal diterima" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"/>
              </label>
              <button disabled={working === `${invoice.id}:payment`} onClick={() => void runInvoiceAction(invoice, "payment")} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Simpan pembayaran</button>
            </div>}
          </article>)}
        </div>}
      </section>
    </div>
  </main>;
}
