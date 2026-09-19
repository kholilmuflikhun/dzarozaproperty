"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, Loader2, Copy, Check, ImageIcon, FileVideo } from "lucide-react";

export default function AdminUploadPage() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isVideo = file?.type.startsWith("video/");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setUrl("");
    setError("");
    setProgress(0);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");
    setUrl("");
    setProgress(0);

    try {
      // Client upload: file dikirim LANGSUNG dari browser ke Vercel Blob,
      // tidak lewat server kita — jadi tidak kena limit 4.5 MB dan cocok
      // untuk file besar seperti video.
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: password,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      setUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-cream-soft flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl2 border border-charcoal-100 bg-white p-8 shadow-card">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
          <ImageIcon size={20} />
        </span>
        <h1 className="mt-4 text-lg font-bold text-charcoal-950">Upload Foto / Video</h1>
        <p className="mt-1 text-sm text-charcoal-400">
          Halaman internal untuk tim Dzaroza Property. Mendukung gambar dan video (maks. 500 MB), file dikirim langsung ke storage.
        </p>

        <form onSubmit={handleUpload} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-charcoal-600">Secret Upload</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan secret upload aktif"
              className="mt-1.5 w-full rounded-lg border border-charcoal-100 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal-600">Pilih File (foto atau video)</label>
            <input
              type="file"
              accept="image/*,video/*,application/pdf"
              required
              onChange={handleFileChange}
              className="mt-1.5 w-full text-sm text-charcoal-600 file:mr-3 file:rounded-full file:border-0 file:bg-charcoal-950 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-orange-500"
            />
            {file && (
              <p className="mt-1.5 text-xs text-charcoal-400">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>

          {preview && isVideo && (
            <video src={preview} controls className="h-40 w-full rounded-lg bg-charcoal-950 object-contain" />
          )}
          {preview && !isVideo && file?.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Pratinjau" className="h-40 w-full rounded-lg object-cover" />
          )}
          {preview && file && !isVideo && !file.type.startsWith("image/") && (
            <div className="flex h-16 items-center gap-3 rounded-lg border border-charcoal-100 px-4">
              <FileVideo size={20} className="text-charcoal-400" />
              <span className="text-sm text-charcoal-600 truncate">{file.name}</span>
            </div>
          )}

          {loading && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
              <div
                className="h-full bg-orange-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !file}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading ? `Mengupload... ${progress}%` : "Upload"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {url && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-semibold text-green-700">Berhasil! URL file:</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="flex-1 truncate rounded-lg border border-green-200 bg-white px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={copyUrl}
                aria-label="Salin URL"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-green-700 leading-relaxed">
              Tempel URL ini ke <code className="font-mono">lib/data.ts</code> pada field yang sesuai
              (foto: <code className="font-mono">image</code>/<code className="font-mono">images</code>/
              <code className="font-mono">photo</code>/<code className="font-mono">cover</code>; video: tambahkan
              field baru sendiri kalau perlu, mis. untuk video promosi E-Class).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
