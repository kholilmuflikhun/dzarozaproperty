import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, BookOpen, GraduationCap, Package, PlayCircle } from "lucide-react";
import PurchaseButton from "@/components/PurchaseButton";
import ProductStatusBadge from "@/components/ProductStatusBadge";
import CountdownTimer from "@/components/CountdownTimer";
import { products } from "@/lib/data";

function ProductSchema({ product }: { product: (typeof products)[number] }) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dzarozaproperty.id";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: `${baseUrl}${product.cover}`,
    sku: product.slug,
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/produk/${product.slug}`,
      priceCurrency: "IDR",
      price: product.priceAmount,
      availability:
        product.status === "coming-soon"
          ? "https://schema.org/PreOrder"
          : "https://schema.org/InStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

const ICONS: Record<string, typeof BookOpen> = { "E-Book": BookOpen, "E-Class": GraduationCap };

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = products.find((p) => p.slug === params.slug);
  if (!product) return { title: "Produk Tidak Ditemukan — Dzaroza Property" };

  return {
    title: `${product.title} — ${product.type} Dzaroza Property`,
    description: product.summary,
  };
}

export default function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { payment?: string };
}) {
  const product = products.find((p) => p.slug === params.slug);
  if (!product) notFound();

  const others = products.filter((p) => p.slug !== product.slug);
  const Icon = ICONS[product.type] ?? Package;
  const paymentStatus = searchParams.payment;

  return (
    <div className="bg-white">
      <ProductSchema product={product} />
      <div className="bg-charcoal-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 blueprint-bg opacity-15" />
        <div className="container-content relative px-6 sm:px-10 lg:px-16 py-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div className="blueprint-frame relative aspect-[3/4] w-full max-w-sm mx-auto lg:mx-0 rounded-xl2 overflow-hidden">
            <Image src={product.cover} 
              alt={product.title} 
              fill 
              unoptimized={product.cover.endsWith(".svg")}
              className="object-cover" 
            />
          </div>

          <div>
            <Link
              href="/#produk"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-orange-400 mb-6"
            >
              <ArrowLeft size={14} />
              Kembali ke Produk
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-400">
                <Icon size={14} />
                {product.type}
              </span>
              <ProductStatusBadge status={product.status} />
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold">{product.title}</h1>
            <p className="mt-4 text-base text-white/70 leading-relaxed">{product.description}</p>
            <p className="mt-6 text-2xl font-bold text-orange-500">{product.price}</p>

            <div className="mt-6 max-w-xs">
              <PurchaseButton
                label={product.ctaLabel}
                productSlug={product.slug}
                productTitle={product.title}
                productType={product.type}
                status={product.status}
                releaseDate={product.releaseDate}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section-pad !py-16">
        {paymentStatus === "success" && (
          <div className="container-content mb-10 rounded-xl2 border border-green-200 bg-green-50 p-5 text-sm text-green-700">
            ✅ Pembayaran berhasil diterima! Tim kami akan mengirim akses {product.type} ke email/WhatsApp Anda dalam 1x24 jam.
          </div>
        )}
        {paymentStatus === "pending" && (
          <div className="container-content mb-10 rounded-xl2 border border-orange-200 bg-orange-50 p-5 text-sm text-orange-700">
            ⏳ Pembayaran Anda sedang diproses. Kami akan mengirim akses {product.type} setelah pembayaran dikonfirmasi.
          </div>
        )}
        {product.status === "coming-soon" && product.releaseDate && (
          <div className="container-content mb-10 rounded-xl2 border border-charcoal-100 bg-cream-soft p-6 text-center">
            <p className="text-sm font-semibold text-charcoal-700">
              Produk ini berstatus Coming Soon dan akan segera dirilis dalam:
            </p>
            <div className="mt-4">
              <CountdownTimer releaseDate={product.releaseDate} />
            </div>
          </div>
        )}

        <div className="container-content grid lg:grid-cols-[1.3fr_1fr] gap-12">
          <div>
            <h2 className="text-lg font-bold text-charcoal-950">Apa yang Anda Dapatkan</h2>
            <ul className="mt-5 space-y-3">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-charcoal-700">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                    <Check size={14} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {product.videoUrl && (
              <div className="mt-10">
                <h3 className="flex items-center gap-2 text-sm font-bold text-charcoal-950">
                  <PlayCircle size={16} className="text-orange-500" />
                  Video Preview
                </h3>
                <div className="mt-3 overflow-hidden rounded-xl2 border border-charcoal-100 bg-charcoal-950">
                  <video
                    src={product.videoUrl}
                    controls
                    playsInline
                    poster={product.cover}
                    className="aspect-video w-full"
                  >
                    Browser Anda tidak mendukung pemutaran video.
                  </video>
                </div>
              </div>
            )}

            <div className="mt-10 rounded-xl2 border border-charcoal-100 bg-cream-soft p-6">
              <h3 className="text-sm font-bold text-charcoal-950">Cocok untuk siapa?</h3>
              <p className="mt-2 text-sm text-charcoal-500 leading-relaxed">
                {product.type === "E-Book"
                  ? "Pemilik properti atau calon investor pemula yang ingin memahami dasar pengelolaan proyek bangun/renovasi yang amanah dan bebas gharar."
                  : "Pemilik proyek yang ingin praktik langsung mengelola tim pekerja, menyusun akad cost and fee, dan menghindari kesalahan umum di lapangan."}
              </p>
            </div>
          </div>

          <aside className="rounded-xl2 border border-charcoal-100 bg-white shadow-card p-6 h-fit sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Harga</p>
            <p className="mt-1 text-3xl font-bold text-charcoal-950">{product.price}</p>
            <div className="mt-5">
              <PurchaseButton
                label={product.ctaLabel}
                productSlug={product.slug}
                productTitle={product.title}
                productType={product.type}
                status={product.status}
                releaseDate={product.releaseDate}
              />
            </div>
            <p className="mt-3 text-[11px] text-charcoal-400 text-center">
              Pembayaran &amp; akses dikonfirmasi langsung oleh tim kami.
            </p>
          </aside>
        </div>

        {others.length > 0 && (
          <div className="container-content mt-16">
            <h2 className="text-lg font-bold text-charcoal-950 mb-6">Produk Lainnya</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {others.map((p) => {
                const OtherIcon = ICONS[p.type] ?? Package;
                return (
                  <Link
                    key={p.slug}
                    href={`/produk/${p.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-xl2 border border-charcoal-100 p-5 hover:border-orange-300 hover:shadow-card transition-all"
                  >
                    <div>
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-orange-500">
                        <OtherIcon size={14} />
                        {p.type}
                      </span>
                      <p className="mt-1 text-sm font-bold text-charcoal-950">{p.title}</p>
                    </div>
                    <span className="text-sm font-bold text-charcoal-400 group-hover:text-orange-500">
                      {p.price}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
