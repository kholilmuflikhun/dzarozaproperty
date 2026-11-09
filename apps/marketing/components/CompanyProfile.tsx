import { Target, Eye, HeartHandshake, MapPin, Building2, ArrowUpRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import TeamSection from "./TeamSection";
import { companyProfile } from "@/lib/data";

export default function CompanyProfile() {
  return (
    <section id="profil" className="section-pad relative overflow-hidden bg-charcoal-950 text-white">
      <div className="pointer-events-none absolute inset-0 blueprint-bg opacity-15" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-48 top-0 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" aria-hidden="true" />
      <div className="relative container-content">
        <SectionHeading eyebrow="Company Profile" title={`Mengenal ${companyProfile.name} Lebih Dekat`} light />

        <div className="mt-10 grid items-start gap-8 lg:mt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 sm:p-8">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">
              <Building2 size={15} aria-hidden="true" />
              Sejarah Singkat — Berdiri sejak {companyProfile.founded}
            </span>
            <p className="mt-5 text-sm leading-relaxed text-white/75 sm:text-base sm:leading-relaxed">{companyProfile.history}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 transition-colors hover:border-orange-400/40">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                <Eye size={21} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-bold">Visi</h3>
              <p className="mt-3 text-sm leading-7 text-white/70">{companyProfile.vision}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 transition-colors hover:border-orange-400/40">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                <Target size={21} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-bold">Misi</h3>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-white/70">
                {companyProfile.mission.map((mission) => (
                  <li key={mission} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                    <span>{mission}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>

        <div className="mt-14 sm:mt-16">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
              <MapPin size={19} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-bold">Lokasi Kantor</h3>
              <p className="mt-0.5 text-xs text-white/55">Temukan lokasi dan informasi kantor kami</p>
            </div>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.045] p-6">
              <p className="text-sm leading-7 text-white/75">{companyProfile.address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyProfile.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-orange-400 hover:bg-orange-500 hover:text-charcoal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <MapPin size={15} aria-hidden="true" /> Buka di Google Maps <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
            <div className="min-h-[260px] overflow-hidden rounded-2xl border border-white/10 bg-charcoal-900 sm:min-h-[320px]">
              <iframe
                src={companyProfile.mapEmbedUrl}
                title="Lokasi Kantor Dzaroza Property"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: 320 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        <div className="mt-14 sm:mt-16">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
              <HeartHandshake size={19} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-bold">Nilai Perusahaan</h3>
              <p className="mt-0.5 text-xs text-white/55">Prinsip yang menjadi dasar setiap pekerjaan</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {companyProfile.values.map((value, index) => (
              <article key={value.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition-all hover:-translate-y-1 hover:border-orange-400/40">
                <span className="font-display text-2xl font-bold text-orange-400/70">{String(index + 1).padStart(2, "0")}</span>
                <h4 className="mt-3 text-base font-bold">{value.title}</h4>
                <p className="mt-2 text-sm leading-6 text-white/65">{value.desc}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 sm:mt-16">
          <h3 className="mb-6 text-lg font-bold">Tim Dzaroza Property</h3>
          <TeamSection />
        </div>
      </div>
    </section>
  );
}
