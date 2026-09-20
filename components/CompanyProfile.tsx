"use client";

import { useState } from "react";
import Image from "next/image";
import { Target, Eye, HeartHandshake, MapPin } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Lightbox from "./Lightbox";
import { companyProfile, team, type TeamMember } from "@/lib/data";

export default function CompanyProfile() {
  const [active, setActive] = useState<TeamMember | null>(null);

  return (
    <section id="profil" className="section-pad bg-charcoal-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 blueprint-bg opacity-15" />
      <div className="relative container-content">
        <SectionHeading
          eyebrow="Company Profile"
          title={`Mengenal ${companyProfile.name} Lebih Dekat`}
          light
        />

        <div className="mt-12 grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              Sejarah Singkat — Berdiri sejak {companyProfile.founded}
            </span>
            <p className="mt-3 text-sm sm:text-base text-white/70 leading-relaxed">
              {companyProfile.history}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="rounded-xl2 border border-white/10 bg-white/5 p-5">
              <Eye size={20} className="text-orange-500" />
              <p className="mt-3 text-sm font-bold">Visi</p>
              <p className="mt-1.5 text-xs text-white/60 leading-relaxed">{companyProfile.vision}</p>
            </div>
            <div className="rounded-xl2 border border-white/10 bg-white/5 p-5">
              <Target size={20} className="text-orange-500" />
              <p className="mt-3 text-sm font-bold">Misi</p>
              <ul className="mt-1.5 space-y-1.5 text-xs text-white/60 leading-relaxed">
                {companyProfile.mission.map((m) => (
                  <li key={m} className="flex gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-500" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <div className="flex items-center gap-2 mb-6">
            <MapPin size={20} className="text-orange-500" />
            <h3 className="text-lg font-bold">Lokasi Kantor</h3>
          </div>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
            <div className="rounded-xl2 border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/70 leading-relaxed">{companyProfile.address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyProfile.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold hover:bg-orange-500 hover:border-orange-500 hover:text-charcoal-950 transition-colors"
              >
                <MapPin size={14} />
                Buka di Google Maps
              </a>
            </div>
            <div className="overflow-hidden rounded-xl2 border border-white/10">
              <iframe
                src={companyProfile.mapEmbedUrl}
                width="100%"
                height="280"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Lokasi Kantor Dzaroza Property"
              />
            </div>
          </div>
        </div>

        <div className="mt-16">
          <div className="flex items-center gap-2 mb-6">
            <HeartHandshake size={20} className="text-orange-500" />
            <h3 className="text-lg font-bold">Nilai Perusahaan</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {companyProfile.values.map((v, i) => (
              <div key={v.title} className="rounded-xl2 border border-white/10 bg-white/5 p-5">
                <span className="font-display text-2xl font-bold text-orange-500/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-sm font-bold">{v.title}</p>
                <p className="mt-1 text-xs text-white/60 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h3 className="text-lg font-bold mb-6">Tim Dzaroza Property</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member) => (
              <div
                key={member.id}
                className="rounded-xl2 overflow-hidden border border-white/10 bg-white/5 hover:border-orange-500/50 transition-colors"
              >
                <button
                  onClick={() => setActive(member)}
                  className="relative block aspect-square w-full"
                >
                  <Image
                    src={member.photo}
                    alt={member.name}
                    fill
                    unoptimized={member.photo.endsWith(".svg")}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover object-top"
                  />
                </button>
                <div className="p-5">
                  <p className="text-base font-bold">{member.name}</p>
                  <p className="mt-1 text-xs text-white/60">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <Lightbox
          images={[active.photo]}
          alt={active.name}
          title={active.name}
          subtitle={active.role}
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}
