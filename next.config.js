/** @type {import('next').NextConfig} */

// Content-Security-Policy dirakit terpisah karena panjang — mengizinkan domain
// yang benar-benar dipakai situs ini: Midtrans Snap, Google OAuth/foto profil,
// Google Drive, Vercel Blob. Kalau nanti nambah integrasi baru yang butuh
// domain eksternal (mis. Google Analytics), tambahkan domainnya di sini juga,
// atau fitur itu akan diblokir browser walau kodenya benar.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://app.sandbox.midtrans.com https://app.midtrans.com https://*.midtrans.com https://www.googletagmanager.com https://*.googletagmanager.com",
  "script-src-elem 'self' 'unsafe-inline' https://app.sandbox.midtrans.com https://app.midtrans.com https://*.midtrans.com https://www.googletagmanager.com https://*.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://drive.google.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.public.blob.vercel-storage.com https://www.googletagmanager.com",
  "font-src 'self' data:",
  "connect-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://*.midtrans.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src https://app.sandbox.midtrans.com https://app.midtrans.com https://*.midtrans.com https://accounts.google.com https://www.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://*.midtrans.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), join-ad-interest-group=(), run-ad-auction=()",
  },
];

const nextConfig = {
  images: {
    dangerouslyAllowSVG: false,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Mengizinkan foto yang di-hosting di Google Drive dipakai lewat next/image.
      // Lihat lib/gdrive.ts untuk cara mendapatkan URL yang benar dari link share Drive.
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Foto yang diupload lewat Vercel Blob (lihat app/api/upload/route.ts)
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
module.exports = nextConfig;