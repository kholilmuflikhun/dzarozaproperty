import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import OrganizationSchema from "@/components/OrganizationSchema";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://dzarozaproperty.id"
  ),
  title: "Dzaroza Property — Jasa Managerial Property, Bangun dan Renovasi Amanah",
  description:
    "Dzaroza Property menyediakan jasa managerial property (bangun & renovasi) dengan akad cost and fee 10%, jasa titip-jual dengan akad salam, serta produk digital E-Book & E-Class — semua transparan tanpa gharar.",
  keywords: [
    "Dzaroza Property",
    "property syariah",
    "jasa bangun rumah amanah",
    "akad salam property",
    "managerial property islami",
  ],
  openGraph: {
    title: "Dzaroza Property — Jasa Managerial Property, Bangun dan Renovasi Amanah",
    description:
      "Akad jelas di awal, transparan dan amanah, tanpa unsur gharar — untuk jasa managerial property maupun titip-jual tanah/bangunan.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="bg-white text-charcoal-950">
        <OrganizationSchema />
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <FloatingWhatsApp />
        </Providers>

        {/* Midtrans Snap.js — sandbox atau production tergantung env,
            dipanggil oleh PurchaseButton.tsx lewat window.snap.pay() */}
                <Script
          src={
            process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
              ? "https://app.midtrans.com/snap/snap.js"
              : "https://app.sandbox.midtrans.com/snap/snap.js"
          }
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="lazyOnload"
        />

        {/* Google Analytics (gtag.js) */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
