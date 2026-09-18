import { Star } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { computeTestimonialStats } from "@/lib/testimonialStats";
import { primaryWhatsApp, type Testimonial } from "@/lib/data";

type Props = { items: Testimonial[] };

export default function TestimoniStats({ items }: Props) {
  const { total, average, distribution } = computeTestimonialStats(items);
  const displayAverage = total > 0 ? average.toFixed(1) : "-";

  return (
    <div className="flex flex-col gap-5">
      {/* Ringkasan rating asli, dihitung langsung dari data testimoni
          (bukan angka statis) — otomatis ikut berubah begitu ada testimoni
          baru masuk. */}
      <div className="rounded-xl2 border border-charcoal-100 bg-charcoal-950 text-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Rating Klien</p>

        <div className="mt-3 flex items-end gap-3">
          <p className="text-5xl font-display font-bold text-orange-500">{displayAverage}</p>
          <div className="pb-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < Math.round(average) ? "fill-orange-500 text-orange-500" : "text-white/20"}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-white/50">
              {total > 0 ? `Dari ${total} testimoni klien` : "Belum ada testimoni"}
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-5 space-y-1.5">
            {distribution.map(({ star, count }) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-white/60">
                  <span className="w-2.5 text-right">{star}</span>
                  <Star size={10} className="shrink-0 fill-orange-500 text-orange-500" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-white/40">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA konsultasi bagi pengunjung yang belum jadi klien */}
      <div className="rounded-xl2 border border-charcoal-100 bg-cream-soft p-6">
        <p className="text-sm font-bold text-charcoal-950">Belum Pernah Pakai Jasa Kami?</p>
        <p className="mt-1.5 text-sm text-charcoal-400 leading-relaxed">
          Konsultasi dulu, gratis. Tim kami siap bantu jawab pertanyaan seputar
          jasa bangun, renovasi, hingga titip-jual properti Anda.
        </p>
        
          href={`https://wa.me/${primaryWhatsApp}?text=${encodeURIComponent(
            "Halo Customer Service Dzaroza Property, saya ingin konsultasi sebelum menggunakan layanan."
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851]"
        >
          <WhatsAppIcon size={16} />
          Konsultasi via WhatsApp
        </a>
      </div>
    </div>
  );
}