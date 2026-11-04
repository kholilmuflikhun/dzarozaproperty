"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowDownToLine, FileText, Loader2, UploadCloud } from "lucide-react";

type ProjectDocument = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: string;
  documentType: string | null;
  documentNumber: string | null;
  version: number;
  parentDocumentId: string | null;
  createdAt: string;
};

const documentTypes = [
  ["QUOTATION", "Surat Penawaran Harga"],
  ["WORK_AGREEMENT", "Surat Perjanjian Kerja"],
  ["PAYMENT_SCHEDULE", "Jadwal Termin Pembayaran"],
  ["CHANGE_ORDER", "Berita Acara Kerja Tambah / Kurang"],
  ["PROGRESS_REPORT", "Laporan Progres Pekerjaan"],
  ["INVOICE", "Invoice / Tagihan"],
  ["HANDOVER", "Berita Acara Serah Terima"],
] as const;

const formatSize = (value: string) => {
  const bytes = Number(value);
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ProjectDocumentsPage() {
  const params = useParams<{ organizationId: string; projectId: string }>();
  const organizationId = params.organizationId;
  const projectId = params.projectId;
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [documentType, setDocumentType] = useState<string>("WORK_AGREEMENT");
  const [documentNumber, setDocumentNumber] = useState("");
  const [parentDocumentId, setParentDocumentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const endpoint = `/api/organizations/${organizationId}/documents`;

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${endpoint}?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal memuat arsip dokumen.");
      setDocuments(body.documents ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat arsip dokumen.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, projectId]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const presignResponse = await fetch(`${endpoint}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          projectId,
          documentType,
          ...(documentNumber.trim() ? { documentNumber: documentNumber.trim() } : {}),
          ...(parentDocumentId ? { parentDocumentId } : {}),
        }),
      });
      const presignBody = await presignResponse.json();
      if (!presignResponse.ok) throw new Error(presignBody.error ?? "Gagal menyiapkan unggahan.");
      const upload = presignBody.upload;
      const storageResponse = await fetch(upload.url, {
        method: upload.method,
        headers: upload.headers,
        body: file,
      });
      if (!storageResponse.ok) throw new Error("Unggahan ke penyimpanan gagal. Silakan coba kembali.");
      const finalizeResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: upload.objectKey }),
      });
      const finalizeBody = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalizeBody.error ?? "Gagal memverifikasi dokumen.");
      setFile(null); setDocumentNumber(""); setParentDocumentId("");
      setNotice("Dokumen berhasil diarsipkan dan diverifikasi.");
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggah dokumen gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(documentId: string) {
    setError("");
    try {
      const response = await fetch(`${endpoint}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", documentId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Gagal menyiapkan unduhan.");
      window.open(body.download.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unduhan gagal.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-medium text-orange-600">Project Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Arsip Dokumen Proyek</h1>
        <p className="mt-2 text-sm text-slate-500">Simpan dan unduh dokumen proyek melalui penyimpanan privat Cloudflare R2.</p>
      </header>

      <form onSubmit={uploadDocument} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-orange-600" />
          <h2 className="font-semibold text-slate-900">Arsipkan dokumen baru</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Jenis dokumen</span>
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
              {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Nomor dokumen (opsional)</span>
            <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} maxLength={120} placeholder="Contoh: SPK/001/2026" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Jenis unggahan</span>
          <select value={parentDocumentId} onChange={(event) => { const selectedId = event.target.value; setParentDocumentId(selectedId); const selected = documents.find((item) => item.id === selectedId); if (selected?.documentNumber) setDocumentNumber(selected.documentNumber); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Dokumen baru (versi 1)</option>
            {documents.filter((item) => item.documentType === documentType && item.documentNumber === (documentNumber.trim() || null)).map((item) => (
              <option key={item.id} value={item.id}>Revisi dari {item.fileName} · v{item.version}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Pilih dokumen induk untuk membuat revisi. Riwayat versi lama tetap tersimpan.</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Pilih berkas (PDF, JPG, PNG, WEBP, CSV, DOCX, XLSX — maks. 20 MB)</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.docx,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-dashed border-slate-300 p-3 text-sm" />
        </label>
        <button type="submit" disabled={!file || busy} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {busy ? "Mengunggah dan memverifikasi..." : "Unggah ke arsip"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="font-semibold text-slate-900">Dokumen tersimpan</h2><p className="text-sm text-slate-500">{documents.length} dokumen tersedia</p></div>
          <button onClick={() => void loadDocuments()} className="text-sm font-medium text-orange-700">Muat ulang</button>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Memuat arsip...</div> : documents.length === 0 ? (
          <div className="p-10 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-medium text-slate-700">Belum ada dokumen</p><p className="mt-1 text-sm text-slate-500">Dokumen yang diunggah untuk proyek ini akan muncul di sini.</p></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{document.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500">{document.documentType?.replaceAll("_", " ") ?? "Dokumen umum"}{document.documentNumber ? ` · ${document.documentNumber}` : ""} · v{document.version} · {formatSize(document.sizeBytes)}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(document.createdAt).toLocaleString("id-ID")}</p>
                </div>
                <button onClick={() => void downloadDocument(document.id)} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><ArrowDownToLine className="h-4 w-4" /><span className="hidden sm:inline">Unduh</span></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
