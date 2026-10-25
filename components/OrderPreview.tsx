"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { primaryWhatsApp, contactEmail } from "@/lib/data";

export type OrderPreviewData = {
  kategori: string;
  title: string;
  rows: { label: string; value: string }[];
  contact: { name: string; phone: string; email?: string; address?: string };
  location?: { lat: number; lng: number } | null;
  photoGroups: { label: string; images: string[] }[];
};

type Props = {
  data: OrderPreviewData;
  onClose: () => void;
};

// Pratinjau order berbentuk dokumen A4. Tombol "Cetak / Simpan PDF" memanggil
// window.print() — di dialog cetak browser pilih "Simpan sebagai PDF". Aturan
// @media print di globals.css menyembunyikan seluruh halaman kecuali
// elemen ber-class "order-print-area" ini.
export default function OrderPreview({ data, onClose }: Props) {
  // Dirender lewat portal langsung di <body> supaya saat cetak elemen lain di
  // body bisa disembunyikan total (display: none) dan PDF tidak berhalaman kosong.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const printedAt = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau order"
      className="order-print-overlay fixed inset-0 z-[100] overflow-y-auto bg-charcoal-950/70 p-3 sm:p-8"
    >
      <div className="order-print-toolbar mx-auto mb-3 flex max-w-3xl items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Pratinjau Order</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-charcoal-950 hover:bg-orange-400 transition-colors"
          >
            <Printer size={16} />
            Cetak / Simpan PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-charcoal-950 hover:bg-charcoal-50"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <article className="order-print-area mx-auto max-w-3xl rounded-lg bg-white p-6 text-charcoal-950 shadow-xl sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-charcoal-950 pb-4">
          <div>
            <h2 className="text-xl font-bold">Dzaroza Property</h2>
            <p className="text-xs text-charcoal-600">
              Jasa Manajerial Property — Purbalingga, Jawa Tengah
            </p>
            <p className="text-xs text-charcoal-600">
              WhatsApp CS: +{primaryWhatsApp} · {contactEmail}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">Formulir Pengajuan Order</p>
            <p className="text-xs text-charcoal-600">Tanggal: {printedAt}</p>
          </div>
        </header>

        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-600">Layanan</h3>
          <p className="mt-1 text-sm font-bold">
            {data.kategori} — {data.title}
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-600">Data Pemohon</h3>
          <dl className="mt-1 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-semibold">Nama</dt>
            <dd>{data.contact.name}</dd>
            <dt className="font-semibold">No. WhatsApp</dt>
            <dd>{data.contact.phone}</dd>
            {data.contact.email && (
              <>
                <dt className="font-semibold">Email</dt>
                <dd className="break-all">{data.contact.email}</dd>
              </>
            )}
            {data.contact.address && (
              <>
                <dt className="font-semibold">Alamat Lengkap</dt>
                <dd className="whitespace-pre-line">{data.contact.address}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-600">Detail Kebutuhan</h3>
          {data.rows.length > 0 ? (
            <dl className="mt-1 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm">
              {data.rows.map((r) => (
                <div key={r.label} className="contents">
                  <dt className="font-semibold">{r.label}</dt>
                  <dd className="whitespace-pre-line break-words">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-sm text-charcoal-400">Belum ada detail yang diisi.</p>
          )}
        </section>

        {data.location && (
          <section className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-600">Lokasi Dibagikan</h3>
            <p className="mt-1 text-sm">
              {data.location.lat.toFixed(6)}, {data.location.lng.toFixed(6)}
            </p>
            <p className="break-all text-xs text-charcoal-600">
              https://www.google.com/maps?q={data.location.lat.toFixed(6)},{data.location.lng.toFixed(6)}
            </p>
          </section>
        )}

        {data.photoGroups.map((g) => (
          <section key={g.label} className="order-print-photos mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-600">{g.label}</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {g.images.map((src, i) => (
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt={`${g.label} ${i + 1}`}
                  className="aspect-[4/3] w-full rounded border border-charcoal-100 object-cover"
                />
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-8 border-t border-charcoal-100 pt-3 text-[11px] text-charcoal-400">
          Dokumen ini adalah ringkasan pengajuan, bukan kontrak. Akad cost and fee / akad salam dibuat jelas di
          awal bersama tim Dzaroza Property setelah pengajuan ditinjau.
        </footer>
      </article>
    </div>,
    document.body
  );
}
