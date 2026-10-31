"use client";

import { useRef, useState } from "react";
import {
  Hammer,
  Wrench,
  Handshake,
  PackageCheck,
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  ClipboardList,
  MapPin,
  ImagePlus,
  X,
  Eye,
} from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import OrderPreview from "./OrderPreview";
import { services, primaryWhatsApp } from "@/lib/data";
import { orderFormFields, orderPhotoFields, ORDER_PHOTO_MAX_BYTES } from "@/lib/orderForm";

import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "bangun-baru": Hammer,
  renovasi: Wrench,
  "titip-jual": Handshake,
  "paket-all-in": PackageCheck,
};

type Status = "idle" | "loading" | "success" | "error";
type GeoLocation = { lat: number; lng: number; accuracy?: number };
type PhotoItem = { id: string; preview: string; url?: string; uploading: boolean; error?: string };

// Kompres di browser (maks 1600px, JPEG 0.8) supaya muat batas upload server
// dan hemat kuota klien yang memotret dengan kamera HP beresolusi tinggi.
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("compress");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

function mapsLink(loc: GeoLocation) {
  return `https://www.google.com/maps?q=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
}

export default function OrderForm() {
  const [step, setStep] = useState(0); // 0: kategori, 1: detail, 2: kontak & review
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, PhotoItem[]>>({});
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "error">("idle");
  const [locError, setLocError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const photoInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const fieldConfig = serviceId ? orderFormFields[serviceId] ?? [] : [];
  const photoConfig = serviceId ? orderPhotoFields[serviceId] ?? [] : [];
  const isUploading = Object.values(photos).some((list) => list.some((p) => p.uploading));

  function previewData() {
    return {
      kategori: selectedService?.kategori ?? "",
      title: selectedService?.title ?? "",
      rows: fieldConfig
        .filter((f) => values[f.name]?.trim())
        .map((f) => ({ label: f.label, value: values[f.name].trim() })),
      contact: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      },
      location,
      photoGroups: photoConfig
        .map((f) => ({
          label: f.label,
          images: (photos[f.name] ?? []).filter((p) => p.url).map((p) => p.preview),
        }))
        .filter((g) => g.images.length > 0),
    };
  }

  function openPreview() {
    const errors = validateContactData();
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setShowPreview(true);
  }

  function shareLocation() {
    if (!navigator.geolocation) {
      setLocStatus("error");
      setLocError("Browser Anda tidak mendukung berbagi lokasi.");
      return;
    }
    setLocStatus("loading");
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocStatus("idle");
      },
      (err) => {
        setLocStatus("error");
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan izin lokasi di browser, lalu coba lagi."
            : "Lokasi tidak dapat diambil. Pastikan GPS/lokasi aktif lalu coba lagi."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function patchPhoto(field: string, id: string, patch: Partial<PhotoItem>) {
    setPhotos((prev) => ({
      ...prev,
      [field]: (prev[field] ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  async function addPhotos(field: string, max: number, files: FileList | null) {
    if (!files) return;
    const room = max - (photos[field]?.length ?? 0);
    for (const original of Array.from(files).slice(0, Math.max(room, 0))) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const preview = URL.createObjectURL(original);
      setPhotos((prev) => ({
        ...prev,
        [field]: [...(prev[field] ?? []), { id, preview, uploading: true }],
      }));
      try {
        const file = await compressImage(original);
        if (file.size > ORDER_PHOTO_MAX_BYTES) {
          patchPhoto(field, id, { uploading: false, error: "Foto terlalu besar (maks 3 MB)." });
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/order/upload", { method: "POST", body });
        const json = await res.json();
        if (!res.ok || typeof json.url !== "string") {
          patchPhoto(field, id, {
            uploading: false,
            error: typeof json.message === "string" ? json.message : "Gagal mengunggah.",
          });
          continue;
        }
        patchPhoto(field, id, { uploading: false, url: json.url });
      } catch {
        patchPhoto(field, id, { uploading: false, error: "Foto tidak dapat dibaca. Gunakan JPG/PNG." });
      }
    }
    const input = photoInputs.current[field];
    if (input) input.value = "";
  }

  function removePhoto(field: string, id: string) {
    setPhotos((prev) => ({ ...prev, [field]: (prev[field] ?? []).filter((p) => p.id !== id) }));
  }

  function uploadedUrls() {
    return Object.fromEntries(
      Object.entries(photos)
        .map(([field, list]) => [field, list.filter((p) => p.url).map((p) => p.url as string)])
        .filter(([, urls]) => (urls as string[]).length > 0)
    ) as Record<string, string[]>;
  }

  function selectCategory(id: string) {
    setServiceId(id);
    setValues({});
    setFieldErrors({});
    setPhotos({});
    setStep(1);
  }

  function updateValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (value.trim()) {
      clearFieldError(name);
    }
  }

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function setContactErrors(errors: Record<string, string>) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.name;
      delete next.phone;
      delete next.email;
      delete next.address;
      return { ...next, ...errors };
    });
  }

  function validateContactData() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const errors: Record<string, string> = {};

    if (!trimmedName) {
      errors.name = "Nama lengkap wajib diisi.";
    } else if (trimmedName.length > 100) {
      errors.name = "Nama maksimal 100 karakter.";
    }

    if (!trimmedPhone) {
      errors.phone = "No. WhatsApp wajib diisi.";
    } else if (trimmedPhone.length > 20) {
      errors.phone = "No. WhatsApp maksimal 20 karakter.";
    }

    if (
      trimmedEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 254)
    ) {
      errors.email =
        trimmedEmail.length > 254
          ? "Email maksimal 254 karakter."
          : "Format email tidak valid.";
    }

    if (address.trim().length > 500) {
      errors.address = "Alamat maksimal 500 karakter.";
    }

    return errors;
  }

  function goToContact() {
    const errors = Object.fromEntries(
      fieldConfig
        .filter((field) => field.required && !values[field.name]?.trim())
        .map((field) => [field.name, `${field.label} wajib diisi.`])
    );
    setFieldErrors((prev) => ({ ...prev, ...errors }));
    if (Object.keys(errors).length > 0) {
      return;
    }
    if (isUploading) {
      setFeedback("Tunggu hingga unggahan foto selesai.");
      return;
    }
    setFeedback("");
    setStep(2);
  }

  function buildWhatsAppMessage() {
    const lines = [
      `Halo Customer Service Dzaroza Property, saya ingin mengajukan order:`,
      ``,
      `Kategori: ${selectedService?.kategori ?? "-"} — ${selectedService?.title ?? "-"}`,
      ``,
      ...fieldConfig
        .filter((f) => values[f.name]?.trim())
        .map((f) => `${f.label}: ${values[f.name].trim()}`),
      ...(location ? [`Lokasi Dibagikan: ${mapsLink(location)}`] : []),
      ...photoConfig.flatMap((f) => {
        const urls = uploadedUrls()[f.name];
        return urls?.length ? [`${f.label}:`, ...urls] : [];
      }),
      ``,
      `Nama: ${name.trim() || "-"}`,
      `No. WhatsApp: ${phone.trim() || "-"}`,
      ...(email.trim() ? [`Email: ${email.trim()}`] : []),
      ...(address.trim() ? [`Alamat Lengkap: ${address.trim()}`] : []),
    ];
    return lines.join("\n");
  }

  function handleWhatsApp() {
    const errors = validateContactData();
    setContactErrors(errors);
    if (Object.keys(errors).length > 0 || !selectedService) {
      return;
    }

    const text = encodeURIComponent(buildWhatsAppMessage());
    window.open(`https://wa.me/${primaryWhatsApp}?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateContactData();
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setStatus("loading");
    setFeedback("");

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          name,
          phone,
          email,
          address,
          fields: values,
          photos: uploadedUrls(),
          location,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setFeedback(
          typeof json.message === "string" ? json.message : "Gagal mengirim order."
        );
        return;
      }

      setStatus("success");
      setFeedback(
        typeof json.message === "string" ? json.message : "Order berhasil dikirim!"
      );
    } catch {
      setStatus("error");
      setFeedback("Terjadi kesalahan jaringan. Coba lagi.");
    }
  }

  function resetForm() {
    setStep(0);
    setServiceId(null);
    setValues({});
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setStatus("idle");
    setFeedback("");
    setFieldErrors({});
    setPhotos({});
    setLocation(null);
    setLocStatus("idle");
    setLocError("");
    setShowPreview(false);
  }

  return (
    <div className="mt-14 rounded-xl2 border border-charcoal-100 bg-white p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/10 text-orange-700">
          <ClipboardList size={20} />
        </span>
        <div>
          <h3 className="text-base font-bold text-charcoal-950">Ajukan Order Layanan Jasa</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-charcoal-400">
            Pilih kategori, isi detail kebutuhan Anda, tim kami akan segera menghubungi.
          </p>
        </div>
      </div>

      {/* --- Indikator langkah --- */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-[11px] font-semibold text-charcoal-400 sm:gap-x-2 sm:text-xs">
        {["Kategori", "Detail", "Kontak"].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                step >= i ? "bg-orange-500 text-charcoal-950" : "bg-charcoal-50 text-charcoal-400"
              }`}
            >
              {i + 1}
            </span>
            <span className={step >= i ? "text-charcoal-800" : ""}>{label}</span>
            {i < 2 && <span className="mx-0.5 h-px w-3 shrink-0 bg-charcoal-100 sm:mx-1 sm:w-5" />}
          </div>
        ))}
      </div>

      {/* --- Step 0: pilih kategori --- */}
      {step === 0 && (
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          {services.map((s) => {
            const Icon = ICONS[s.id] ?? Hammer;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectCategory(s.id)}
                className="flex items-start gap-3 rounded-xl border border-charcoal-100 p-4 text-left hover:border-orange-500 transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-700">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-400">
                    {s.kategori}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-charcoal-950">{s.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* --- Step 1: detail dinamis sesuai kategori --- */}
      {step === 1 && selectedService && (
        <div className="mt-6">
          <p className="text-sm font-bold text-charcoal-950">
            {selectedService.kategori} — {selectedService.title}
          </p>

          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            {fieldConfig.map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label htmlFor={`order-${f.name}`} className="mb-1.5 block text-xs font-semibold text-charcoal-600">
                  {f.label}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={`order-${f.name}`}
                    value={values[f.name] ?? ""}
                    onChange={(e) => updateValue(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    maxLength={2000}
                    aria-invalid={Boolean(fieldErrors[f.name])}
                    aria-describedby={fieldErrors[f.name] ? `order-${f.name}-error` : undefined}
                    className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 resize-none focus:outline-none focus:ring-2 ${
                      fieldErrors[f.name]
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                  />
                ) : f.type === "select" ? (
                  <select
                    id={`order-${f.name}`}
                    value={values[f.name] ?? ""}
                    onChange={(e) => updateValue(f.name, e.target.value)}
                    aria-invalid={Boolean(fieldErrors[f.name])}
                    aria-describedby={fieldErrors[f.name] ? `order-${f.name}-error` : undefined}
                    className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 ${
                      fieldErrors[f.name]
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                  >
                    <option value="" className="bg-white text-charcoal-950">
                      Pilih {f.label.toLowerCase()}
                    </option>
                    {f.options?.map((opt) => (
                      <option key={opt} value={opt} className="bg-white text-charcoal-950">
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`order-${f.name}`}
                    value={values[f.name] ?? ""}
                    onChange={(e) => updateValue(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    maxLength={500}
                    aria-invalid={Boolean(fieldErrors[f.name])}
                    aria-describedby={fieldErrors[f.name] ? `order-${f.name}-error` : undefined}
                    className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 ${
                      fieldErrors[f.name]
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                  />
                )}
                {fieldErrors[f.name] && (
                  <p id={`order-${f.name}-error`} className="mt-1.5 text-xs text-red-600" role="alert">
                    {fieldErrors[f.name]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* --- Bagikan lokasi (semua kategori) --- */}
          <div className="mt-5 rounded-xl border border-charcoal-100 p-4">
            <p className="text-xs font-semibold text-charcoal-600">
              Bagikan Lokasi <span className="font-normal text-charcoal-400">(opsional)</span>
            </p>
            <p className="mt-1 text-xs text-charcoal-400">
              Memudahkan tim kami menemukan titik lokasi lahan/bangunan. Gunakan tombol ini saat Anda berada di lokasi.
            </p>
            {location ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <a
                  href={mapsLink(location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-orange-700 hover:underline"
                >
                  <MapPin size={14} />
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)} — lihat di peta
                </a>
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="text-charcoal-400 hover:text-red-600"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={shareLocation}
                disabled={locStatus === "loading"}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-charcoal-100 px-4 py-2 text-xs font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-700 transition-colors disabled:opacity-60"
              >
                {locStatus === "loading" ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                Bagikan Lokasi Saya
              </button>
            )}
            {locStatus === "error" && locError && (
              <p className="mt-2 text-xs text-red-600" role="alert">{locError}</p>
            )}
          </div>

          {/* --- Upload foto sesuai kategori --- */}
          {photoConfig.length > 0 && (
            <div className="mt-5 grid gap-5">
              {photoConfig.map((pf) => {
                const list = photos[pf.name] ?? [];
                return (
                  <div key={pf.name}>
                    <p className="text-xs font-semibold text-charcoal-600">
                      {pf.label} <span className="font-normal text-charcoal-400">(opsional, maks {pf.max} foto)</span>
                    </p>
                    {pf.hint && <p className="mt-0.5 text-xs text-charcoal-400">{pf.hint}</p>}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {list.map((p) => (
                        <div key={p.id} className="relative h-20 w-20">
                          <img
                            src={p.preview}
                            alt=""
                            className={`h-20 w-20 rounded-lg border object-cover ${p.error ? "border-red-500" : "border-charcoal-100"}`}
                          />
                          {p.uploading && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                              <Loader2 size={16} className="animate-spin text-orange-700" />
                            </span>
                          )}
                          {p.error && (
                            <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-red-600/90 px-1 py-0.5 text-center text-[9px] leading-tight text-white">
                              {p.error}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removePhoto(pf.name, p.id)}
                            aria-label="Hapus foto"
                            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-950 text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {list.length < pf.max && (
                        <button
                          type="button"
                          onClick={() => photoInputs.current[pf.name]?.click()}
                          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-charcoal-200 text-[11px] font-semibold text-charcoal-400 hover:border-orange-500 hover:text-orange-700 transition-colors"
                        >
                          <ImagePlus size={18} />
                          Tambah
                        </button>
                      )}
                    </div>
                    <input
                      ref={(el) => {
                        photoInputs.current[pf.name] = el;
                      }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addPhotos(pf.name, pf.max, e.target.files)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {feedback && status !== "success" && step === 1 && (
            <p className="mt-3 text-sm text-red-600" role="alert">{feedback}</p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-2 rounded-full border border-charcoal-100 px-5 py-2.5 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Kembali
            </button>
            <button
              type="button"
              onClick={goToContact}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-charcoal-950 hover:bg-orange-400 transition-colors"
            >
              Lanjut
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* --- Step 2: kontak, review & kirim --- */}
      {step === 2 && selectedService && status !== "success" && (
        <form onSubmit={handleSubmit} noValidate className="mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="order-contact-name" className="mb-1.5 block text-xs font-semibold text-charcoal-600">
                Nama Lengkap <span className="text-orange-700">*</span>
              </label>
              <input
                id="order-contact-name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) {
                    clearFieldError("name");
                  }
                }}
                placeholder="Nama Lengkap"
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "order-contact-name-error" : undefined}
                className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 ${
                  fieldErrors.name
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
                }`}
              />
              {fieldErrors.name && (
                <p id="order-contact-name-error" className="mt-1.5 text-xs text-red-600" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="order-contact-phone" className="mb-1.5 block text-xs font-semibold text-charcoal-600">
                No. HP (WhatsApp) <span className="text-orange-700">*</span>
              </label>
              <input
                id="order-contact-phone"
                required
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (e.target.value.trim()) {
                    clearFieldError("phone");
                  }
                }}
                placeholder="No. HP (WhatsApp)"
                maxLength={20}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "order-contact-phone-error" : undefined}
                className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 ${
                  fieldErrors.phone
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
                }`}
              />
              {fieldErrors.phone && (
                <p id="order-contact-phone-error" className="mt-1.5 text-xs text-red-600" role="alert">
                  {fieldErrors.phone}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="order-contact-email" className="mb-1.5 block text-xs font-semibold text-charcoal-600">
              Email <span className="font-normal text-charcoal-400">(opsional)</span>
            </label>
            <input
              id="order-contact-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value.trim()) {
                  clearFieldError("email");
                }
              }}
              placeholder="nama@email.com"
              maxLength={254}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "order-contact-email-error" : undefined}
              className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 ${
                fieldErrors.email
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
              }`}
            />
            {fieldErrors.email && (
              <p id="order-contact-email-error" className="mt-1.5 text-xs text-red-600" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="order-contact-address" className="mb-1.5 block text-xs font-semibold text-charcoal-600">
              Alamat Lengkap <span className="font-normal text-charcoal-400">(opsional)</span>
            </label>
            <textarea
              id="order-contact-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (e.target.value.trim().length <= 500) {
                  clearFieldError("address");
                }
              }}
              placeholder="Jalan, RT/RW, Desa/Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi, Kode Pos"
              rows={3}
              maxLength={500}
              aria-invalid={Boolean(fieldErrors.address)}
              aria-describedby={fieldErrors.address ? "order-contact-address-error" : undefined}
              className={`w-full resize-none rounded-lg border bg-white px-4 py-2.5 text-sm text-charcoal-950 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 ${
                fieldErrors.address
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-charcoal-100 focus:border-orange-500 focus:ring-orange-500/20"
              }`}
            />
            {fieldErrors.address && (
              <p id="order-contact-address-error" className="mt-1.5 text-xs text-red-600" role="alert">
                {fieldErrors.address}
              </p>
            )}
          </div>

          {/* --- Ringkasan sebelum dikirim --- */}
          <div className="mt-5 rounded-xl border border-charcoal-100 bg-cream-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Ringkasan Order
            </p>
            <p className="mt-1.5 text-sm font-bold text-charcoal-950">
              {selectedService.kategori} — {selectedService.title}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-charcoal-600">
              {fieldConfig
                .filter((f) => values[f.name]?.trim())
                .map((f) => (
                  <li key={f.name}>
                    <span className="font-semibold">{f.label}:</span> {values[f.name]}
                  </li>
                ))}
              {address.trim() && (
                <li>
                  <span className="font-semibold">Alamat:</span> {address.trim()}
                </li>
              )}
              {location && (
                <li>
                  <span className="font-semibold">Lokasi dibagikan:</span> {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </li>
              )}
              {photoConfig
                .filter((f) => (uploadedUrls()[f.name] ?? []).length > 0)
                .map((f) => (
                  <li key={f.name}>
                    <span className="font-semibold">{f.label}:</span> {uploadedUrls()[f.name].length} foto
                  </li>
                ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-full border border-charcoal-100 px-5 py-2.5 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Kembali
            </button>
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-charcoal-950 hover:bg-orange-400 transition-colors disabled:opacity-60"
            >
              {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Kirim Order
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="inline-flex items-center gap-2 rounded-full border border-charcoal-200 px-5 py-2.5 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-700 transition-colors"
            >
              <Eye size={16} />
              Pratinjau & Cetak PDF
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-2 rounded-full border border-charcoal-200 px-5 py-2.5 text-sm font-semibold text-charcoal-800 hover:border-[#167F3D] hover:text-[#167F3D] transition-colors"
            >
              <WhatsAppIcon size={16} />
              Kirim via WhatsApp
            </button>
          </div>

          {status === "error" && feedback && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-600">{feedback}</p>
          )}
          {showPreview && <OrderPreview data={previewData()} onClose={() => setShowPreview(false)} />}
        </form>
      )}

      {/* --- Sukses --- */}
      {status === "success" && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-5">
          <span className="flex items-center gap-2 text-sm font-bold text-green-700">
            <CheckCircle2 size={18} />
            {feedback}
          </span>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-full border border-charcoal-100 px-5 py-2.5 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-700 transition-colors"
          >
            Ajukan Order Baru
          </button>
        </div>
      )}
    </div>
  );
}