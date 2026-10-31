"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Quotation = {
  id: string;
  number: string;
  status: string;
  total: string;
  createdAt: string;
  client: { id: string; name: string };
  project?: { id: string; code: string; name: string } | null;
  items: Array<{ id: string; description: string; quantity: string; lineTotal: string }>;
};
const money = (value: string | number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const labels: Record<string, string> = { DRAFT: "Draft", SENT: "Menunggu klien", ACCEPTED: "Disetujui", REJECTED: "Ditolak", CONVERTED: "Menjadi proyek" };

export default function QuotationManagementPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const endpoint = `/api/organizations/${encodeURIComponent(organizationId)}/quotations`;
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalLinks, setApprovalLinks] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Gagal memuat quotation.");
      setQuotations(payload.quotations ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat quotation.");
    } finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  async function createQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking("create"); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(), ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
          items: [{ description: description.trim(), quantity: Number(quantity), unitPrice: Number(unitPrice) }],
          discount: Number(discount), tax: Number(tax),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Quotation gagal dibuat.");
      setNotice(`Quotation ${payload.quotation.number} berhasil dibuat sebagai Draft.`);
      setClientId(""); setProjectId(""); setDescription(""); setQuantity("1"); setUnitPrice(""); setDiscount("0"); setTax("0");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Quotation gagal dibuat."); }
    finally { setWorking(null); }
  }

  async function quotationAction(quotation: Quotation, action: "send" | "approval" | "convert" | "invoice") {
    setWorking(`${quotation.id}:${action}`); setError(""); setNotice("");
    try {
      let response: Response;
      if (action === "send") {
        response = await fetch(`${endpoint}/${quotation.id}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send" }),
        });
      } else if (action === "approval") {
        response = await fetch(`${endpoint}/${quotation.id}/approval-link`, { method: "POST" });
      } else if (action === "convert") {
        response = await fetch(`${endpoint}/${quotation.id}/convert`, { method: "POST" });
      } else {
        response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/invoices`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quotationId: quotation.id }),
        });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Aksi quotation gagal.");
      if (action === "approval" && payload.approval?.url) {
        setApprovalLinks((current) => ({ ...current, [quotation.id]: payload.approval.url }));
        setNotice("Link persetujuan siap dibagikan. Salin dan kirim hanya kepada kontak klien terverifikasi.");
      } else if (action === "approval") setNotice(payload.message ?? "Link persetujuan dikirim melalui email klien.");
      else if (action === "convert") setNotice(`Proyek ${payload.project.code} berhasil dibuat.`);
      else if (action === "invoice") setNotice(`Invoice ${payload.invoice.number} berhasil dibuat.`);
      else setNotice("Quotation berhasil diterbitkan.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Aksi quotation gagal."); }
    finally { setWorking(null); }
  }

  async function copyLink(quotationId: string) {
    const link = approvalLinks[quotationId];
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setNotice("Link persetujuan berhasil disalin."); }
    catch { setError("Clipboard tidak tersedia. Salin link yang tampil secara manual."); }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-8 md:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href={`/dashboard/${organizationId}`} className="text-sm font-semibold text-blue-700">← Kembali ke workspace</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Dzaroza Property OS · Sales</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Manajemen Penawaran</h1><p className="mt-1 text-sm text-slate-600">Buat penawaran, kirim persetujuan klien dan konversikan penawaran menjadi proyek.</p></div>
        <Link href={`/dashboard/${organizationId}/invoices`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Manajemen Invoice</Link>
      </header>
      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Buat quotation</h2>
        <p className="mt-1 text-sm text-slate-500">Total dihitung di server. Masukkan Client ID dan Project ID bila penawaran terkait proyek yang sudah ada.</p>
        <form onSubmit={createQuotation} className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Client ID
            <input required value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="ID klien" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <label className="text-sm font-medium text-slate-700">Project ID (opsional)
            <input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="ID proyek" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <label className="text-sm font-medium text-slate-700">Deskripsi layanan
            <input required minLength={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Jasa manajemen properti" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-slate-700">Kuantitas
              <input required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/>
            </label>
            <label className="text-sm font-medium text-slate-700">Harga satuan
              <input required type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="1500000" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-slate-700">Diskon (IDR)
              <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/>
            </label>
            <label className="text-sm font-medium text-slate-700">Pajak (IDR)
              <input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/>
            </label>
          </div>
          <div className="md:col-span-2"><button disabled={working === "create"} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{working === "create" ? "Membuat…" : "Buat Draft Quotation"}</button></div>
        </form>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Daftar quotation</h2><button onClick={() => void load()} className="text-sm font-semibold text-blue-700">Muat ulang</button></div>
        {loading ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Memuat quotation…</p> : quotations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Belum ada quotation.</p> : <div className="grid gap-4">
          {quotations.map((quotation) => <article key={quotation.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{quotation.number}</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{quotation.client.name}</h3><p className="mt-1 text-xs text-slate-500">{quotation.project ? `${quotation.project.code} · ${quotation.project.name}` : "Belum terhubung ke proyek"} · {new Date(quotation.createdAt).toLocaleDateString("id-ID")}</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{labels[quotation.status] ?? quotation.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{quotation.items.length} item</p><p className="text-xl font-bold tabular-nums">{money(quotation.total)}</p></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quotation.status === "DRAFT" && <button disabled={working === `${quotation.id}:send`} onClick={() => void quotationAction(quotation, "send")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Terbitkan</button>}
              {quotation.status === "SENT" && <button disabled={working === `${quotation.id}:approval`} onClick={() => void quotationAction(quotation, "approval")} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">Kirim persetujuan klien</button>}
              {["ACCEPTED", "CONVERTED"].includes(quotation.status) && <button disabled={working === `${quotation.id}:invoice`} onClick={() => void quotationAction(quotation, "invoice")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Buat invoice</button>}
              {quotation.status === "ACCEPTED" && <button disabled={working === `${quotation.id}:convert`} onClick={() => void quotationAction(quotation, "convert")} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Konversi menjadi proyek</button>}
              {approvalLinks[quotation.id] && <button onClick={() => void copyLink(quotation.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Salin link persetujuan</button>}
            </div>
            {approvalLinks[quotation.id] && <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{approvalLinks[quotation.id]}</p>}
          </article>)}
        </div>}
      </section>
    </div>
  </main>;
}
