import { ArrowRight, ShieldCheck, HandCoins, KeyRound, CheckCircle2 } from "lucide-react";
import { getTestimonials } from "@/lib/testimonials.server";
import { computeTestimonialStats } from "@/lib/testimonialStats";
import HeroCompare from "./HeroCompare";

const QUICK_SERVICES = [
  { icon: HandCoins, title: "Cost and Fee 10%", desc: "Jasa bangun & renovasi, akad jelas sejak awal." },
  { icon: KeyRound, title: "Titip & Jual Properti", desc: "Titip & jualkan tanah/bangunan tanpa gharar." },
  { icon: ShieldCheck, title: "Amanah & Transparan", desc: "Laporan biaya terbuka di setiap tahap." },
];

const TRUST_POINTS = [
  "Akad dan ruang lingkup disepakati di awal",
  "Biaya serta progres disampaikan transparan",
  "Komunikasi langsung dengan tim Dzaroza",
];

export default async function Hero() {
  const testimonials = await getTestimonials();
  const { average, total } = computeTestimonialStats(testimonials);
  // Jangan menampilkan rating 5.0 jika belum ada testimoni yang terverifikasi.
  const displayRating = total > 0 ? average.toFixed(1) : "—";

  return (
    <section id="beranda" className="relative isolate overflow-hidden bg-charcoal-950 text-white">
      <div className="absolute inset-0 blueprint-bg opacity-25" aria-hidden="true" />
      <div className="absolute -right-40 -top-36 h-[34rem] w-[34rem] rounded-full bg-orange-500/15 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-48 -left-40 h-[28rem] w-[28rem] rounded-full bg-white/5 blur-3xl" aria-hidden="true" />

      <div className="relative container-content px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.94fr] lg:gap-14">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_0_4px_rgba(249,115,22,0.12)]" />
              Jasa Managerial Property Profesional & Amanah
            </div>

            <h1 className="mt-6 max-w-2xl text-[2.55rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.65rem]">
              Membangun Rumah,
              <span className="mt-1 block text-orange-400">Menjaga Amanah.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Dzaroza Property mengelola proyek bangun dan renovasi Anda dengan akad cost and fee 10% yang jelas sejak awal, serta membantu memasarkan tanah dan bangunan — transparan, tanpa gharar, sesuai syariat Islam.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#layanan"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-charcoal-950 shadow-card transition-all hover:-translate-y-0.5 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-950"
              >
                Konsultasikan Properti Anda
                <ArrowRight size={17} />
              </a>
              <a
                href="#portofolio"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-orange-400/70 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Lihat Portofolio
              </a>
            </div>

            <ul className="mt-8 grid gap-3 sm:grid-cols-1">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-white/75">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-orange-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {QUICK_SERVICES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm transition-colors hover:border-orange-400/40 hover:bg-white/[0.08]"
                >
                  <item.icon size={20} className="text-orange-400" />
                  <p className="mt-3 text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/55">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px] animate-fade-up lg:max-w-none" style={{ animationDelay: "0.12s" }}>
            <div className="absolute -inset-3 rounded-[2rem] border border-orange-400/15" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/15 bg-white/5 p-2 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
              <HeroCompare rating={displayRating} />
            </div>
            <div className="relative mt-4 flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-charcoal-900/95 px-4 py-3 shadow-card backdrop-blur lg:absolute lg:-bottom-5 lg:left-8 lg:right-8 lg:mt-0 lg:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Pendampingan Properti</p>
                <p className="mt-1 truncate text-sm font-bold text-white">Dari perencanaan hingga serah terima</p>
              </div>
              <ShieldCheck size={23} className="shrink-0 text-orange-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
