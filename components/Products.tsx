import Image from "next/image";
import Link from "next/link";
import { BookOpen, GraduationCap, Package, Check, PlayCircle } from "lucide-react";
import SectionHeading from "./SectionHeading";
import PurchaseButton from "./PurchaseButton";
import ProductStatusBadge from "./ProductStatusBadge";
import { products } from "@/lib/data";

const ICONS: Record<string, typeof BookOpen> = { "E-Book": BookOpen, "E-Class": GraduationCap };

export default function Products() {
  return (
    <section id="produk" className="section-pad bg-white">
      <div className="container-content">
        <SectionHeading
          eyebrow="Produk Digital"
          title="Belajar Property Amanah Lewat E-Book & E-Class"
          description="Selain jasa lapangan, Dzaroza Property menghadirkan produk edukasi agar Anda lebih paham seluk-beluk pengelolaan properti yang transparan dan bebas gharar."
        />

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {products.map((p) => {
            const Icon = ICONS[p.type] ?? Package;
            return (
              <div
                key={p.slug}
                className="group flex flex-col overflow-hidden rounded-xl2 border border-charcoal-100 bg-cream-soft hover:shadow-card-hover hover:border-orange-200 transition-all"
              >
                <div className="relative h-52 w-full bg-charcoal-950">
                  <Image src={p.cover} 
                    alt={p.title} 
                    fill 
                    unoptimized={p.cover.endsWith(".svg")}
                    className="object-cover" 
                  />
                  <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-charcoal-950/85 px-3 py-1.5 text-xs font-semibold text-orange-400">
                    <Icon size={14} />
                    {p.type}
                  </span>
                  <ProductStatusBadge status={p.status} className="absolute top-3 right-3" />
                  {p.videoUrl && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-charcoal-950/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <PlayCircle size={12} />
                      Video
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-7">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold text-charcoal-950">{p.title}</h3>
                    <span className="shrink-0 text-lg font-bold text-orange-500">{p.price}</span>
                  </div>
                  <p className="mt-2 text-sm text-charcoal-400 leading-relaxed">{p.summary}</p>

                  <ul className="mt-5 space-y-2.5 flex-1">
                    {p.features.slice(0, 3).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-charcoal-800">
                        <Check size={16} className="mt-0.5 shrink-0 text-orange-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 flex items-center gap-3">
                    <Link
                      href={`/produk/${p.slug}`}
                      className="inline-flex items-center justify-center rounded-full border border-charcoal-100 px-5 py-3 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-500 transition-colors"
                    >
                      Detail
                    </Link>
                    <PurchaseButton
                      label={p.ctaLabel}
                      productSlug={p.slug}
                      productTitle={p.title}
                      productType={p.type}
                      status={p.status}
                      releaseDate={p.releaseDate}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
