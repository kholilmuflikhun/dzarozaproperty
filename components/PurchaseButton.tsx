"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Clock } from "lucide-react";
import { primaryWhatsApp, type ProductStatus } from "@/lib/data";
import ComingSoonModal from "./ComingSoonModal";

type Snap = {
  pay: Function;
};

type Props = {
  label: string; // "Pesan Sekarang" | "Berlangganan Sekarang"
  productSlug: string;
  productTitle: string;
  productType: string;
  status: ProductStatus;
  releaseDate?: string;
  className?: string;
};

export default function PurchaseButton({
  label,
  productSlug,
  productTitle,
  productType,
  status,
  releaseDate,
  className = "",
}: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showComingSoon, setShowComingSoon] = useState(false);

  const isComingSoon = status === "coming-soon";

  const waLink = `https://wa.me/${primaryWhatsApp}?text=${encodeURIComponent(
    `Halo Dzaroza Property, saya ingin memesan ${productType}: ${productTitle}.`
  )}`;

  async function handleClick() {
    // Produk berstatus Coming Soon tidak bisa dibeli — tampilkan pop up + countdown.
    if (isComingSoon) {
      setShowComingSoon(true);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: productSlug,
          name: session?.user?.name,
          email: session?.user?.email,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.token) {
        setError(json.message ?? "Payment Gateway sedang tidak tersedia. Coba lagi nanti.");
        setLoading(false);
        return;
      }

      setLoading(false);

      const snap = (window as Window & { snap?: Snap }).snap;
      if (!snap) {
        setError("Sistem pembayaran belum termuat, coba muat ulang halaman.");
        return;
      }

      snap.pay(json.token, {
        onSuccess: () => {
          router.push(`/produk/${productSlug}?payment=success`);
        },
        onPending: () => {
          router.push(`/produk/${productSlug}?payment=pending`);
        },
        onError: () => {
          setError("Pembayaran gagal diproses. Silakan coba lagi.");
        },
        onClose: () => {
          // Pengguna menutup popup Snap sebelum menyelesaikan pembayaran.
        },
      });
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors disabled:opacity-70 ${
          isComingSoon
            ? "bg-charcoal-800 text-white hover:bg-charcoal-600"
            : "bg-orange-500 text-white hover:bg-orange-600"
        }`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isComingSoon ? (
          <Clock size={16} />
        ) : (
          <CreditCard size={16} />
        )}
        {isComingSoon ? "Coming Soon" : label}
      </button>

      {!isComingSoon && error && (
        <p className="mt-2 text-xs text-red-600">
          {error}{" "}
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-700">
            Atau pesan via WhatsApp.
          </a>
        </p>
      )}

      {showComingSoon && (
        <ComingSoonModal
          productTitle={productTitle}
          releaseDate={releaseDate}
          onClose={() => setShowComingSoon(false)}
        />
      )}
    </div>
  );
}
