import { instagramAccounts, contactEmail, primaryWhatsApp } from "@/lib/data";

// JSON-LD Organization/LocalBusiness — muncul di setiap halaman lewat layout.tsx.
// Ini yang membantu Google/ChatGPT/Perplexity memahami identitas bisnis Anda
// secara terstruktur (nama, kontak, lokasi, sejak kapan berdiri) sehingga
// lebih mungkin dikutip sebagai sumber jawaban.
export default function OrganizationSchema() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dzarozaproperty.id";

  const schema = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: "Dzaroza Property",
    url: baseUrl,
    logo: `${baseUrl}/images/logo-1.svg`,
    foundingDate: "2019",
    description:
      "Jasa managerial property (bangun & renovasi bangunan) dan titip-jual tanah/bangunan dengan akad cost and fee 10% dan akad salam — transparan, amanah, tanpa gharar.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Purbalingga",
      addressRegion: "Jawa Tengah",
      addressCountry: "ID",
    },
    email: contactEmail,
    telephone: `+${primaryWhatsApp}`,
    sameAs: instagramAccounts.map((ig) => ig.url),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: `+${primaryWhatsApp}`,
      areaServed: "ID",
      availableLanguage: "Indonesian",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}