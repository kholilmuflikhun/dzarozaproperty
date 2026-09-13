"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Star, Quote } from "lucide-react";
import SectionHeading from "./SectionHeading";
import TestimoniForm from "./TestimoniForm";
import type { Testimonial } from "@/lib/data";

const PALETTE = ["#EA580C", "#0F0F10", "#FB8B3D", "#1C1C1E"];
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return Math.abs(hash);
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    return <Image src={photo} alt={name} width={44} height={44} className="rounded-full object-cover" />;
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const bg = PALETTE[hashString(name) % PALETTE.length];
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {initials}
    </span>
  );
}

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    fetch("/api/testimoni")
      .then((res) => res.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <section id="testimoni" className="section-pad bg-white">
      <div className="container-content">
        <SectionHeading
          eyebrow="Review & Testimoni"
          title="Apa Kata Klien Kami"
          description="Kepercayaan (amanah) klien adalah fondasi dari setiap proyek yang kami kerjakan."
        />

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((t) => (
            <div key={t.id} className="rounded-xl2 border border-charcoal-100 bg-cream-soft p-6">
              <Quote className="text-orange-500/40" size={26} />
              <p className="mt-3 text-sm text-charcoal-800 leading-relaxed min-h-[70px]">
                &ldquo;{t.message}&rdquo;
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Avatar name={t.name} photo={t.photo} />
                <div>
                  <p className="text-sm font-bold text-charcoal-950">{t.name}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < t.rating ? "fill-orange-500 text-orange-500" : "text-charcoal-100"}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-xl">
          <TestimoniForm />
        </div>
      </div>
    </section>
  );
}
