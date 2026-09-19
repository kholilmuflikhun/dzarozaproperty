import { ArrowRight, ShieldCheck, HandCoins, KeyRound } from "lucide-react";
import { getTestimonials } from "@/lib/testimonials.server";
import { computeTestimonialStats } from "@/lib/testimonialStats";
import HeroCompare from "./HeroCompare";

const QUICK_SERVICES = [
  { icon: HandCoins, title: "Cost and Fee 10%", desc: "Jasa bangun & renovasi, akad jelas sejak awal." },
  { icon: KeyRound, title: "Akad Salam", desc: "Titip & jualkan tanah/bangunan tanpa gharar." },
  { icon: ShieldCheck, title: "Amanah & Transparan", desc: "Laporan biaya terbuka di setiap tahap." },
];

export default async function Hero() {
  // Rating diambil otomatis dari data testimoni asli (sama seperti sumber
  // data di section Testimoni), bukan angka statis — jadi selalu akurat
  // begitu ada testimoni baru masuk.
  const testimonials = await getTestimonials();
  const { average, total } = computeTestimonialStats(testimonials);
  const displayRating = total > 0 ? average.toFixed(1) : "5.0";

  return (
    <section id="beranda" className="relative overflow-hidden bg-charcoal-950 text-white">
      <div className="absolute inset-0 blueprint-bg opacity-40" />
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />

      <div className="relative container-content px-6 sm:px-10 lg:px-16 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div className="animate-fadeUp">
            <span className="eyebrow">
              <span className="h-px w-6 bg-orange-500" />
              Jasa Manageral Property Profesional & Amanah
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.3rem] font-bold leading-[1.08] tracking-tight">
              Membangun Rumah, Menjaga{" "}
              <span className="text-orange-500">Amanah.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/70 leading-relaxed max-w-xl">
              Dzaroza Property mengelola proyek bangun dan renovasi Anda
              dengan akad cost and fee 10% yang jelas sejak awal, serta
              membantu memasarkan tanah dan bangunan lewat akad salam —
              transparan, tanpa gharar, sesuai syariat Islam.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#layanan"
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
              >
                Lihat Layanan Jasa
                <ArrowRight size={16} />
              </a>
              <a
                href="#produk"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:border-orange-500 hover:text-orange-400 transition-colors"
              >
                Lihat Produk Digital
              </a>
            </div>

            <div className="mt-12 grid sm:grid-cols-3 gap-5">
              {QUICK_SERVICES.map((s, i) => (
                <div
                  key={s.title}
                  style={{ animationDelay: `${0.15 + i * 0.1}s` }}
                  className="animate-fadeUp rounded-xl2 border border-white/10 bg-white/5 p-4"
                >
                  <s.icon size={20} className="text-orange-500" />
                  <p className="mt-3 text-sm font-semibold">{s.title}</p>
                  <p className="mt-1 text-xs text-white/60 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden lg:block animate-fadeUp" style={{ animationDelay: "0.1s" }}>
            <HeroCompare rating={displayRating} />
          </div>
        </div>
      </div>
    </section>
  );
}