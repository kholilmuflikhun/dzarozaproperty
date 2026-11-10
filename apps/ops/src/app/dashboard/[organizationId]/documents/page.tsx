"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";

type DocumentItem = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: string;
  createdAt: string;
  status: string;
};
type UploadResponse = {
  upload: {
    documentId: string;
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    objectKey: string;
    expiresIn: number;
    maxSizeBytes: number;
  };
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

function putFileWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (value: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 80));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(85);
        resolve();
      } else if (request.status === 412 || request.status === 409) {
        reject(new Error("Objek sudah pernah dibuat. Unggahan ulang ditolak untuk mencegah overwrite."));
      } else {
        reject(new Error(`Penyimpanan menolak unggahan (HTTP ${request.status}). Periksa konfigurasi CORS R2 jika permintaan diblokir browser.`));
      }
    };
    request.onerror = () => reject(new Error("Koneksi ke penyimpanan gagal. Periksa koneksi dan konfigurasi CORS R2."));
    request.onabort = () => reject(new Error("Unggahan dibatalkan."));
    request.send(file);
  });
}

export default function DocumentManagementPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const endpoint = `/api/organizations/${encodeURIComponent(organizationId)}/documents`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Gagal memuat dokumen.");
      setDocuments(payload.documents ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat dokumen.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function uploadFile(file?: File) {
    if (!file) return;
    setError(""); setNotice(""); setProgress(0);
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Format tidak didukung. Gunakan PDF, JPG, PNG, WEBP, CSV, DOCX, atau XLSX.");
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      setError("Ukuran file harus lebih dari 0 dan maksimal 20 MB.");
      return;
    }

    setUploading(true);
    try {
      const presignResponse = await fetch(`${endpoint}/presign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presignPayload = await presignResponse.json() as UploadResponse | { error?: string };
      if (!presignResponse.ok || !("upload" in presignPayload)) {
        throw new Error(("error" in presignPayload && presignPayload.error) || "Gagal menyiapkan unggahan.");
      }

      const upload = presignPayload.upload;
      // Forward every signed header verbatim. In particular, If-None-Match prevents overwrites.
      await putFileWithProgress(upload.url, upload.headers, file, setProgress);

      const finalizeResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objectKey: upload.objectKey }),
      });
      const finalizePayload = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalizePayload.error ?? "Verifikasi dokumen gagal.");
      setProgress(100);
      setNotice(`Dokumen ${file.name} berhasil diunggah dan didaftarkan.`);
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggahan gagal.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function downloadDocument(documentId: string, fileName: string) {
    setError(""); setNotice("");
    try {
      const response = await fetch(`${endpoint}/presign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "download", documentId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.download?.url) {
        throw new Error(payload.error ?? "Tautan unduhan tidak tersedia.");
      }
      const anchor = document.createElement("a");
      anchor.href = payload.download.url;
      anchor.download = fileName;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice(`Unduhan ${fileName} dimulai.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unduhan gagal.");
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Workspace · Dokumen</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Pusat Dokumen</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Simpan dan kelola dokumen organisasi dengan akses berbasis tenant serta tautan penyimpanan sementara.</p>
        </div>
        <button type="button" onClick={() => void loadDocuments()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16} /> Muat ulang
        </button>
      </header>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div>}
      {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /><p>{notice}</p></div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UploadCloud size={23} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-950">Unggah dokumen</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Maksimal 20 MB per file. Format yang didukung: PDF, JPG, PNG, WEBP, CSV, DOCX, XLSX.</p>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.docx,.xlsx,application/pdf,image/jpeg,image/png,image/webp,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={uploading} onChange={(event) => void uploadFile(event.target.files?.[0])} className="mt-4 block w-full max-w-xl cursor-pointer rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-600 file:mr-4 file:border-0 file:bg-slate-900 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700 disabled:opacity-50" />
            {uploading && <div className="mt-4 max-w-xl"><div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Mengunggah dan memverifikasi…</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(progress, 8)}%` }} /></div></div>}
          </div>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-700" />
          <p>Setiap file memperoleh object key unik. Header keamanan dari server diteruskan apa adanya ke R2 untuk mencegah penimpaan objek. Jangan unggah dokumen yang tidak berhak Anda akses.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h2 className="font-semibold text-slate-950">Dokumen organisasi</h2><p className="mt-1 text-xs text-slate-500">{documents.length} dokumen tersedia</p></div>
          <FileText size={20} className="text-slate-400" />
        </div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Memuat daftar dokumen…</div> : documents.length === 0 ? <div className="p-10 text-center"><FileText size={30} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Belum ada dokumen</p><p className="mt-1 text-xs text-slate-500">Dokumen yang berhasil diunggah akan muncul di sini.</p></div> : <ul className="divide-y divide-slate-100">
          {documents.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FileText size={19} /></div>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.fileName}</p><p className="mt-1 text-xs text-slate-500">{formatBytes(Number(item.sizeBytes))} · {formatDate(item.createdAt)}</p></div>
            </div>
            <button type="button" onClick={() => void downloadDocument(item.id, item.fileName)} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"><Download size={15} /> Unduh</button>
          </li>)}
        </ul>}
      </section>
    </div>
  );
}
