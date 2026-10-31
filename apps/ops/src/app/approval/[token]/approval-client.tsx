"use client";

import { useEffect, useState } from "react";

type Quotation = {
  number: string;
  clientName: string;
  total: string;
  issuedAt: string | null;
  items: Array<{ description: string; quantity: string; unitPrice: string; lineTotal: string }>;
};
type ApprovalResponse = { quotation: Quotation; allowedDecisions: string[] };

const money = (value: string) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(Number(value));

export default function ApprovalClient({ token }: { token: string }) {
  const [data, setData] = useState<ApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/public/quotation-approvals/${encodeURIComponent(token)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Tautan persetujuan tidak tersedia.");
        setData(payload);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Gagal memuat penawaran.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [token]);

  async function submitDecision(nextDecision: "ACCEPTED" | "REJECTED") {
    if (submitting || decision) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/quotation-approvals/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ decision: nextDecision }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Keputusan belum dapat disimpan.");
      setDecision(nextDecision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengirim keputusan.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Dzaroza Property</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Persetujuan Penawaran</h1>
        <p className="mt-2 text-sm text-slate-600">Tinjau rincian penawaran sebelum memberikan keputusan.</p>
      </header>

      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Memuat dokumen penawaran…</div>}
      {!loading && error && !data && <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center"><h2 className="font-semibold text-slate-900">Tautan tidak tersedia</h2><p className="mt-2 text-sm text-slate-600">{error}</p><p className="mt-4 text-xs text-slate-500">Tautan mungkin telah kedaluwarsa atau sudah digunakan. Hubungi tim Dzaroza Property untuk meminta tautan baru.</p></div>}

      {data && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nomor penawaran</p><h2 className="mt-1 text-xl font-bold text-slate-950">{data.quotation.number}</h2></div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Menunggu keputusan</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-slate-500">Ditujukan kepada</p><p className="mt-1 font-semibold text-slate-900">{data.quotation.clientName}</p></div>
            <div><p className="text-xs text-slate-500">Tanggal diterbitkan</p><p className="mt-1 font-semibold text-slate-900">{data.quotation.issuedAt ? new Date(data.quotation.issuedAt).toLocaleDateString("id-ID") : "—"}</p></div>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <h3 className="font-semibold text-slate-900">Rincian penawaran</h3>
          <div className="mt-4 divide-y divide-slate-100">
            {data.quotation.items.map((item, index) => <div key={index} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{item.description}</p><p className="mt-1 text-xs text-slate-500">{item.quantity} × {money(item.unitPrice)}</p></div>
              <p className="font-semibold tabular-nums text-slate-900">{money(item.lineTotal)}</p>
            </div>)}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5"><p className="font-semibold text-slate-900">Total penawaran</p><p className="text-2xl font-bold tabular-nums text-slate-950">{money(data.quotation.total)}</p></div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-6 sm:p-8">
          {decision ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">{decision === "ACCEPTED" ? "Penawaran disetujui" : "Penawaran ditolak"}</p><p className="mt-1 text-sm text-emerald-800">Keputusan Anda telah tercatat. Anda dapat menutup halaman ini.</p></div> : <>
            <p className="text-sm leading-6 text-slate-600">Dengan memilih keputusan, Anda mengonfirmasi respons terhadap penawaran di atas. Tautan ini hanya dapat digunakan satu kali.</p>
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={submitting} onClick={() => void submitDecision("REJECTED")} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Tolak penawaran</button>
              <button type="button" disabled={submitting} onClick={() => void submitDecision("ACCEPTED")} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Menyimpan…" : "Setujui penawaran"}</button>
            </div>
          </>}
        </div>
      </section>}
      <p className="mt-6 text-center text-xs text-slate-500">Jika Anda tidak mengenali penawaran ini, abaikan tautan dan hubungi pengirim melalui kanal resmi.</p>
    </div>
  </main>;
}
