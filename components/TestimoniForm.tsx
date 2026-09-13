"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { Star, Send, Loader2, CheckCircle2, LogOut } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function TestimoniForm() {
  const { data: session, status: authStatus } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");

  // Login with Google bersifat OPSIONAL — cuma untuk auto-isi nama, email,
  // dan foto profil. Form tetap bisa diisi & dikirim manual tanpa login sama sekali.
  useEffect(() => {
    if (session?.user) {
      setName((prev) => prev || session.user.name || "");
      setEmail((prev) => prev || session.user.email || "");
    }
  }, [session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setFeedback("");

    try {
      const res = await fetch("/api/testimoni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          photo: session?.user?.image ?? null,
          email,
          phone,
          address,
          rating,
          message,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setFeedback(json.message ?? "Gagal mengirim testimoni.");
        return;
      }

      setStatus("success");
      setFeedback(json.message ?? "Testimoni berhasil dikirim!");
      setPhone("");
      setAddress("");
      setMessage("");
      setRating(5);
      // Nama & email sengaja tidak direset supaya nyaman kalau user mau kirim lagi.
    } catch {
      setStatus("error");
      setFeedback("Terjadi kesalahan jaringan. Coba lagi.");
    }
  }

  return (
    <div className="rounded-xl2 border border-charcoal-100 bg-cream-soft p-6 sm:p-7">
      <h3 className="text-base font-bold text-charcoal-950">Bagikan Pengalaman Anda</h3>
      <p className="mt-1 text-sm text-charcoal-400">
        Isi form di bawah untuk mengirim review. Login with Google bersifat opsional,
        hanya untuk mengisi otomatis nama, email &amp; foto profil.
      </p>

      {/* --- Login with Google: opsional --- */}
      {authStatus === "loading" && (
        <div className="mt-5 flex items-center gap-2 text-sm text-charcoal-400">
          <Loader2 size={16} className="animate-spin" />
          Memuat sesi...
        </div>
      )}

      {authStatus !== "loading" && !session?.user && (
        <button
          type="button"
          onClick={() => signIn("google")}
          className="mt-5 inline-flex items-center gap-3 rounded-full border border-charcoal-200 bg-white px-5 py-3 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C39.9 37.4 44 31.8 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          Login with Google <span className="text-charcoal-400 font-normal">(opsional, isi otomatis)</span>
        </button>
      )}

      {session?.user && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-charcoal-100 bg-white p-3">
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-bold text-charcoal-950">{session.user.name}</p>
              <p className="text-xs text-charcoal-400">Login terhubung — nama & email otomatis terisi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1 text-xs font-semibold text-charcoal-400 hover:text-orange-500"
          >
            <LogOut size={13} />
            Keluar
          </button>
        </div>
      )}

      {/* --- Form utama: selalu tampil, tidak wajib login --- */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

        <div className="grid sm:grid-cols-2 gap-4">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Alamat"
            className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const value = i + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`Beri rating ${value}`}
                className="p-0.5"
              >
                <Star
                  size={22}
                  className={value <= rating ? "fill-orange-500 text-orange-500" : "text-charcoal-100"}
                />
              </button>
            );
          })}
        </div>

        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ceritakan pengalaman Anda menggunakan layanan Dzaroza Property..."
          rows={3}
          className="w-full rounded-lg border border-charcoal-100 bg-white px-4 py-2.5 text-sm resize-none focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />

        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Kirim Review
        </button>

        {feedback && (
          <p className={`flex items-center gap-2 text-sm ${status === "success" ? "text-green-600" : "text-red-600"}`}>
            {status === "success" && <CheckCircle2 size={16} />}
            {feedback}
          </p>
        )}
      </form>
    </div>
  );
}
