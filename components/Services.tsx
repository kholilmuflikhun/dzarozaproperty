import { Hammer, Wrench, Handshake, ShieldCheck } from "lucide-react";
import SectionHeading from "./SectionHeading";
import ConsultButton from "./ConsultButton";
import { services, syariahStatement } from "@/lib/data";

const ICONS: Record<string, any> = {
  "bangun-baru": Hammer,
  renovasi: Wrench,
  "titip-jual": Handshake,
};

export default function Services() {
  return (
    <section id="layanan" className="section-pad bg-charcoal-950 text-white relative">
      <div className="absolute inset-0 blueprint-bg opacity-20 pointer-events-none" />
      <div className="relative container-content">
        <SectionHeading
          eyebrow="Layanan Jasa"
          title="Tiga Kategori Layanan Utama Kami"
          light
        />

        <div className="mt-6 flex items-start gap-3 rounded-xl2 border border-orange-500/30 bg-orange-500/10 p-5 max-w-3xl">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-orange-400" />
          <p className="text-sm text-orange-100 leading-relaxed">
            <span className="font-bold">{syariahStatement}</span>
          </p>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-6">
          {services.map((s) => {
            const Icon = ICONS[s.id] ?? Hammer;
            return (
              <div
                key={s.id}
                className="flex flex-col rounded-xl2 border border-white/10 bg-white/5 p-7 hover:border-orange-500/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                    <Icon size={20} />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                    {s.kategori}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold leading-snug">{s.title}</h3>

                <span className="mt-3 inline-flex w-fit items-center rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-charcoal-950">
                  {s.akad}
                </span>

                <p className="mt-4 text-sm text-white/60 leading-relaxed">{s.description}</p>

                <ul className="mt-4 space-y-2 text-sm text-white/70 flex-1">
                  {s.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                      {pt}
                    </li>
                  ))}
                </ul>

                <ConsultButton serviceTitle={s.title} className="mt-6" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
