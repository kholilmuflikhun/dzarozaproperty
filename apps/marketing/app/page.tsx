import dynamic from "next/dynamic";
import Hero from "@/components/Hero";
import Products from "@/components/Products";
import Services from "@/components/Services";

// Section di bawah layar (butuh scroll) dimuat belakangan, tidak ikut
// menghambat render pertama (LCP) yang jadi tanggung jawab Hero di atas.
// ssr tetap aktif (default) supaya konten ini tetap ke-crawl Google/SEO,
// hanya proses hydration JS-nya yang ditunda.
const Portfolio = dynamic(() => import("@/components/Portfolio"), {
  loading: () => <div className="h-96 bg-cream-soft animate-pulse" />,
});
const Testimonials = dynamic(() => import("@/components/Testimonials"), {
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});
const CompanyProfile = dynamic(() => import("@/components/CompanyProfile"), {
  loading: () => <div className="h-96 bg-charcoal-950 animate-pulse" />,
});
const FAQ = dynamic(() => import("@/components/FAQ"), {
  loading: () => <div className="h-96 bg-white animate-pulse" />,
});

// Hero mengambil rating rata-rata langsung dari data testimoni (Google
// Sheets/fallback statis) saat render di server. Revalidate berkala supaya
// angkanya ikut ter-update tanpa perlu rebuild manual tiap ada testimoni baru.
export const revalidate = 1800; // 30 menit

export default function HomePage() {
  return (
    <>
      <Hero />
      <Products />
      <Services />
      <Portfolio />
      <Testimonials />
      <CompanyProfile />
      <FAQ />
    </>
  );
}