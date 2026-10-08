"use client";

import { useState } from "react";
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
} from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { services, primaryWhatsApp } from "@/lib/data";
import { orderFormFields } from "@/lib/orderForm";

const ICONS: Record<string, any> = {
  "bangun-baru": Hammer,
  renovasi: Wrench,
  "titip-jual": Handshake,
  "paket-all-in": PackageCheck,
};

type Status = "idle" | "loading" | "success" | "error";

export default function OrderForm() {
  const [step, setStep] = useState(0); // 0: kategori, 1: detail, 2: kontak & review
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");
  const [stepError, setStepError] = useState("");

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const fieldConfig = serviceId ? orderFormFields[serviceId] ?? [] : [];

  function selectCategory(id: string) {
    setServiceId(id);
    setValues({});
    setStepError("");
    setStep(1);
  }

  function updateValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function goToContact() {
    const missing = fieldConfig.find((f) => f.required && !values[f.name]?.trim());
    if (missing) {
      setStepError(`Mohon lengkapi "${missing.label}" terlebih dahulu.`);
      return;
    }
    setStepError("");
    setStep(2);
  }

  function buildWhatsAppMessage() {
    const lines = [
      `Halo Customer Service Dzaroza Property, saya ingin mengajukan order:`,
      ``,
      `Kategori: ${selectedService?.kategori} — ${selectedService?.title}`,
      ``,
      ...fieldConfig
        .filter((f) => values[f.name]?.trim())
        .map((f) => `${f.label}: ${values[f.name].trim()}`),
      ``,
      `Nama: ${name}`,
      `No. WhatsApp: ${phone}`,
      ...(email ? [`Email: ${email}`] : []),
    ];
    return lines.join("\n");
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(buildWhatsAppMessage());
    window.open(`https://wa.me/${primaryWhatsApp}?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setStepError("Nama dan No. WhatsApp wajib diisi.");
      return;
    }
    setStepError("");
    setStatus("loading");
    setFeedback("");

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, name, phone, email, fields: values }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setFeedback(json.message ?? "Gagal mengirim order.");
        return;
      }

      setStatus("success");
      setFeedback(json.message ?? "Order berhasil dikirim!");
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
    setStatus("idle");
    setFeedback("");
    setStepError("");
  }

  return (
    <div className="mt-14 rounded-xl2 border border-charcoal-100 bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/10 text-orange-700">
          <ClipboardList size={20} />
        </span>
        <div>
          <h3 className="text-base font-bold text-charcoal-950">Ajukan Order Layanan Jasa</h3>
          <p className="text-sm text-charcoal-400">
            Pilih kategori, isi detail kebutuhan Anda, tim kami akan segera menghubungi.
          </p>
        </div>
      </div>

      {/* --- Indikator langkah --- */}
      <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-charcoal-400">
        {["Kategori", "Detail", "Kontak"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                step >= i ? "bg-orange-500 text-charcoal-950" : "bg-charcoal-50 text-charcoal-400"
              }`}
            >
              {i + 1}
            </span>
            <span className={step >= i ? "text-charcoal-800" : ""}>{label}</span>
            {i < 2 && <span className="mx-1 h-px w-5 bg-charcoal-100" />}
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
                <label className="mb-1.5 block text-xs font-semibold text-charcoal-600">
                  {f.label}
                  {f.required && <span className="text-orange-700"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={values[f.name] ?? ""}
                    onChange={(e) => updateValue(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm resize-none focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                ) : f.type === "select" ? (
                  <select
                    value={values[f.name] ?? ""}
                    onChange={(e) => updateValue(f.name, e.target.value)}
                    className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="">Pilih {f.label.toLowerCase()}</option>
                    {f.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={values[f.name] ?? ""}
                    onChange={(e) => updateValue(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                )}
              </div>
            ))}
          </div>

          {stepError && <p className="mt-3 text-sm text-red-600">{stepError}</p>}

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
        <form onSubmit={handleSubmit} className="mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Lengkap"
              className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="No. HP (WhatsApp)"
              className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (opsional)"
            className="mt-4 w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />

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
            </ul>
          </div>

          {stepError && <p className="mt-3 text-sm text-red-600">{stepError}</p>}

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