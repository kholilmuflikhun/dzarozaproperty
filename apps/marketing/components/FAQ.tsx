"use client";

import { useId, useState } from "react";
import { ChevronDown, MessageCircle, ArrowUpRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { faqs, primaryWhatsApp } from "@/lib/data";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const panelId = useId();

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <section id="faq" className="section-pad bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <div className="container-content">
        <SectionHeading
          eyebrow="Pertanyaan Umum"
          title="Yang Sering Ditanyakan"
          description="Belum ketemu jawabannya? Hubungi tim kami langsung lewat WhatsApp."
        />

        <div className="mt-9 grid items-start gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="max-w-3xl space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              const answerId = `${panelId}-answer-${index}`;
              return (
                <article key={faq.question} className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-orange-300 bg-orange-50/40" : "border-charcoal-100 bg-white hover:border-charcoal-200"}`}>
                  <h3>
                    <button
                      type="button"
                      id={`${panelId}-question-${index}`}
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 sm:px-6"
                    >
                      <span className="text-sm font-semibold leading-6 text-charcoal-950 sm:text-base">{faq.question}</span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${isOpen ? "bg-orange-500 text-charcoal-950" : "bg-cream-soft text-charcoal-500"}`}>
                        <ChevronDown size={17} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                      </span>
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={answerId} role="region" aria-labelledby={`${panelId}-question-${index}`} className="px-5 pb-5 sm:px-6">
                      <div className="border-t border-orange-200/70 pt-4">
                        <p className="text-sm leading-relaxed text-charcoal-600">{faq.answer}</p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <aside className="rounded-2xl border border-charcoal-100 bg-cream-soft p-6 lg:sticky lg:top-28">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <MessageCircle size={21} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-bold text-charcoal-950">Masih punya pertanyaan?</h3>
            <p className="mt-2 text-sm leading-6 text-charcoal-600">Tim Dzaroza Property siap membantu menjelaskan layanan dan proses konsultasi properti Anda.</p>
            <a
              href={`https://wa.me/${primaryWhatsApp}?text=${encodeURIComponent("Assalamu’alaikum, saya ingin bertanya tentang layanan Dzaroza Property.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-charcoal-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2"
            >
              Hubungi via WhatsApp <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <p className="mt-3 text-center text-xs text-charcoal-500">Respons langsung dari tim kami</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
