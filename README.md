# Dzaroza Property — Company Profile, Portofolio & Penjualan Produk Digital

Next.js 16 (App Router) + TypeScript + Tailwind CSS + NextAuth.js (Google Login) + Google Sheets API + Midtrans Snap + Vercel Blob + Upstash Redis + Google Analytics.

## Menjalankan Proyek

```bash
npm install
cp .env.example .env.local   # isi kredensial (lihat bawah)
npm run dev
```

Buka <http://localhost:3000>

## Struktur Proyek

```text
dzaroza-property/
├── app/
│   ├── layout.tsx                                  # Root layout: Providers (NextAuth), Navbar, Footer, Floating WA, GA script
│   ├── page.tsx                                    # Halaman utama — semua section (Hero, Products, Services, Portfolio, Testimonials, CompanyProfile, FAQ)
│   ├── not-found.tsx
│   ├── globals.css
│   ├── icon.svg                                    # Favicon (SVG)
│   ├── robots.ts                                   # SEO robots.txt (blok /admin/)
│   ├── sitemap.ts                                  # Sitemap XML dinamis
│   ├── produk/[slug]/page.tsx                      # Detail produk digital (/produk/e-book, /produk/e-class, dll.)
│   ├── privasi/page.tsx                            # Halaman Kebijakan Privasi (/privasi)
│   ├── admin/
│   │   ├── layout.tsx                              # Guard: wajib login admin (ADMIN_EMAILS)
│   │   └── upload/page.tsx                         # Halaman upload file ke Vercel Blob (/admin/upload)
│   └── api/
│       ├── auth/[...nextauth]/route.ts             # Google Login (NextAuth)
│       ├── testimoni/route.ts                      # POST/GET testimoni ⇄ Google Sheets
│       ├── upload/route.ts                         # Client upload ke Vercel Blob (maks. 500 MB)
│       └── checkout/
│           ├── route.ts                            # Buat transaksi Midtrans Snap
│           └── notification/route.ts               # Webhook Midtrans (verifikasi SHA-512)
├── components/
│   ├── Navbar.tsx                                  # Smooth scroll anchor ("auto section jump")
│   ├── Footer.tsx                                  # WA per anggota tim + IG + email
│   ├── FloatingWhatsApp.tsx                        # Tombol WA melayang, expand ke kontak tim
│   ├── Hero.tsx                                    # Tagline properti Islami/amanah
│   ├── HeroCompare.tsx                             # Before/after slider foto (di Hero)
│   ├── Products.tsx                                # E-Book, E-Class, Webinar + PurchaseButton
│   ├── PurchaseButton.tsx                          # Tombol beli → Midtrans Snap / fallback WA
│   ├── ComingSoonModal.tsx                         # Pop-up produk Coming Soon + countdown
│   ├── CountdownTimer.tsx                          # Countdown real-time menuju releaseDate
│   ├── ProductStatusBadge.tsx                      # Badge status produk (Coming Soon/New Release/Published)
│   ├── Services.tsx                                # 3 kategori jasa + penekanan teks syariah
│   ├── ConsultButton.tsx                           # Dropdown 3 kontak WA per layanan jasa
│   ├── Portfolio.tsx                               # Filter (useState) + tag + lightbox multi-slide
│   ├── Lightbox.tsx                                # Modal foto carousel (panah, dots, keyboard)
│   ├── CarouselDots.tsx                            # Indikator titik carousel Lightbox
│   ├── Testimonials.tsx                            # Grid review, fetch dari /api/testimoni
│   ├── TestimoniForm.tsx                           # Login with Google + form review manual
│   ├── TestimoniStats.tsx                          # Statistik rating agregat testimoni
│   ├── CompanyProfile.tsx                          # Sejarah, visi-misi, nilai, grid tim + lightbox
│   ├── FAQ.tsx                                     # Accordion FAQ dari lib/data.ts
│   ├── OrganizationSchema.tsx                      # JSON-LD structured data (SEO)
│   ├── WhatsAppIcon.tsx                            # Ikon WA resmi (reusable)
│   ├── Providers.tsx                               # SessionProvider (NextAuth)
│   └── SectionHeading.tsx
├── lib/
│   ├── data.ts                                     # Semua data statis (produk, jasa, portofolio, tim, testimoni, FAQ)
│   ├── auth.ts                                     # authOptions NextAuth (Google Provider) + getAdminSession()
│   ├── gdrive.ts                                   # Helper URL foto Google Drive → next/image
│   ├── redis.ts                                    # Upstash Redis client + Order CRUD (saveOrder, getOrder, updateOrder)
│   ├── rate-limit.ts                               # Rate limiter (Upstash sliding-window / in-memory fallback)
│   ├── testimonials.server.ts                      # Fetch testimoni dari Google Sheets (server-side)
│   ├── testimonialStats.ts                         # Kalkulasi statistik rating agregat
│   └── useColumns.ts                               # Custom hook jumlah kolom grid responsif
├── types/
│   ├── next-auth.d.ts                              # Perluasan tipe session.user.id
│   └── midtrans-client.d.ts                        # Type declaration untuk midtrans-client
├── public/
│   ├── images/
│   │   ├── brand/
│   │   │   ├── logo-navbar-1.svg                   # Logo versi gelap (Navbar)
│   │   │   └── logo-footer-1.svg                   # Logo versi terang (Footer)
│   │   ├── portfolio/{project}/*.{jpg,png}         # Foto portofolio nyata per project
│   │   ├── team/{arif,kholil,kaiska,supriyatno}.svg
│   │   └── products/{ebook-cover,eclass-thumb,webinar-cover}.svg
│   ├── llms.txt                                    # Panduan untuk AI/LLM crawler
│   └── googlee83260135c75e4d1.html                 # Verifikasi Google Search Console
├── tailwind.config.ts
├── next.config.js                                  # CSP headers, image remotePatterns
└── package.json
```

## Kredensial yang Perlu Diisi (`.env.local`)

| Variabel | Untuk apa | Cara dapatkan |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL situs (wajib valid) — dipakai `metadataBase`, sitemap, dan SEO | `http://localhost:3000` untuk dev; URL Vercel/domain kustom untuk produksi — **jangan dikosongkan** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login with Google di form testimoni | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), buat OAuth Client ID tipe "Web application", redirect URI: `http://localhost:3000/api/auth/callback/google` |
| `NEXTAUTH_URL` | URL callback NextAuth | `http://localhost:3000` untuk dev; URL produksi untuk deployment |
| `NEXTAUTH_SECRET` | Enkripsi sesi NextAuth | `openssl rand -base64 32` |
| `ADMIN_EMAILS` | Email yang boleh akses `/admin/upload` | Daftar email dipisah koma, mis. `admin@example.com` |
| `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` | Kirim data testimoni ke Google Sheets | Buat Service Account di Google Cloud Console → aktifkan **Google Sheets API** → generate JSON key |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID spreadsheet tujuan | Ambil dari URL sheet: `docs.google.com/spreadsheets/d/**ID_INI**/edit` — lalu **share** sheet ke email service account (role Editor) |
| `GOOGLE_SHEETS_RANGE` | Range tab testimoni | Default: `Testimoni!A:G` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Penyimpanan order & rate-limiting global (production) | Buat database di [console.upstash.com](https://console.upstash.com/), salin REST URL dan token |
| `BLOB_READ_WRITE_TOKEN` | Upload foto/video ke Vercel Blob | Buka Vercel Dashboard → Storage → Create Database → **Blob** → hubungkan ke project; jalankan `vercel env pull .env.local` untuk dev lokal |
| `UPLOAD_SECRET` | Kata sandi halaman `/admin/upload` | String acak panjang buatan sendiri |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | Payment Gateway Midtrans Snap | [dashboard.midtrans.com](https://dashboard.midtrans.com) → Settings → Access Keys. Gunakan prefix `SB-` untuk sandbox |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client key Midtrans (expose ke browser) | Sama dengan `MIDTRANS_CLIENT_KEY` |
| `MIDTRANS_IS_PRODUCTION` / `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | Mode sandbox vs live | `"false"` untuk testing, `"true"` untuk go-live |
| `NEXT_PUBLIC_WHATSAPP_PRIMARY` | Nomor WA default (format internasional tanpa `+`) | Contoh: `6282xxxxxxxxx` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 | [analytics.google.com](https://analytics.google.com) → buat property → salin Measurement ID (format `G-XXXXXXXXXX`) |

> Tanpa kredensial di atas, situs tetap bisa dijalankan untuk preview: tombol "Login with Google" akan mengarah ke halaman error NextAuth standar, dan `/api/testimoni` otomatis fallback menampilkan data statis dari `lib/data.ts`.

## Catatan Implementasi Penting

1. **Google Sheets sebagai pengganti Google Form** — `app/api/testimoni/route.ts` memakai `googleapis` dengan Service Account untuk `spreadsheets.values.append`. Struktur kolom: `Timestamp | Nama | Email | No.HP | Alamat | Rating | Review | FotoURL`. Buat sheet dengan nama tab `Testimoni` dan header sesuai kolom tersebut (atau sesuaikan `GOOGLE_SHEETS_RANGE`).
2. **Payment Gateway (Midtrans Snap) — sudah tersambung penuh:**
   - `app/api/checkout/route.ts` — membuat transaksi Snap sungguhan (`snap.createTransaction`) dan mengembalikan `token`.
   - `app/api/checkout/notification/route.ts` — webhook server-to-server, memverifikasi `signature_key` (SHA-512) sebelum menandai pesanan lunas. **Daftarkan URL ini di dashboard Midtrans** (Settings → Configuration → Payment Notification URL).
   - `components/PurchaseButton.tsx` — tombol "Pesan Sekarang"/"Berlangganan Sekarang" langsung memanggil `/api/checkout` saat diklik (tanpa dropdown pilihan) lalu membuka popup pembayaran lewat `window.snap.pay(token)`. Jika gateway gagal/tidak tersedia, muncul pesan error kecil dengan link fallback ke WhatsApp.
   - `app/layout.tsx` — memuat script `snap.js` (sandbox/production otomatis sesuai `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION`).
   - Setelah bayar, pengguna diarahkan ke `/produk/[slug]?payment=success` atau `?payment=pending` dengan banner status otomatis.
   - **TODO produksi:** di `notification/route.ts`, sambungkan ke database untuk menyimpan status pesanan, dan kirim notifikasi otomatis (WhatsApp/email) ke pembeli saat status `paid`.
3. **Gambar placeholder lokal** — semua foto (portofolio, tim, cover produk) memakai ilustrasi SVG lokal di `public/images/` (offline-safe, tanpa dependensi ke layanan gambar eksternal). Ganti dengan foto asli (jpg/png) sebelum go-live; path tinggal disesuaikan di `lib/data.ts`.
4. **Smooth scroll "auto section jump"** — ditangani lewat `scroll-behavior: smooth` di `globals.css` + `element.scrollIntoView()` di `Navbar.tsx`, tanpa reload halaman.
5. **Login with Google bersifat opsional** — `components/TestimoniForm.tsx` menampilkan form testimoni lengkap (nama, email, No. HP, alamat, rating, review) yang bisa langsung diisi manual tanpa login sama sekali. Tombol "Login with Google" tetap tersedia sebagai kemudahan opsional untuk auto-isi nama, email, dan foto profil — berguna sambil menunggu proses verifikasi/appeal OAuth di Google Cloud Console selesai (lihat bagian kredensial di atas).
6. **Logo** — `public/images/brand/logo-navbar-1.svg` (versi gelap, dipakai di Navbar) dan `public/images/brand/logo-footer-1.svg` (versi terang, dipakai di Footer). Favicon di `app/icon.svg` juga sudah pakai mark yang sama. Ganti ketiga file ini dengan logo asli sebelum go-live — path tetap sama, tidak perlu ubah kode.
7. **Tombol "Konsultasi Layanan Ini" (dropdown 3 kontak WhatsApp)** — `components/ConsultButton.tsx` dipakai di setiap card Layanan Jasa; klik akan membuka dropdown berisi 3 anggota tim (Arif, Kholil, Kaiska) dengan nomor WA masing-masing, pesan otomatis terisi nama layanan yang relevan.
8. **Ikon WhatsApp resmi** — `components/WhatsAppIcon.tsx` (glyph telepon-dalam-gelembung-chat) dipakai konsisten di semua tombol kontak WA (Footer, Floating Button, Company Profile, dropdown Konsultasi) — menggantikan ikon chat generik dari Lucide.
9. **Status Produk Digital (Coming Soon / New Release / Published)** — tiap produk di `lib/data.ts` punya field `status` dan `releaseDate` (opsional). Efeknya:
   - `"coming-soon"` → tombol beli berubah jadi "Coming Soon" (non-aktif untuk checkout), klik memunculkan pop up (`components/ComingSoonModal.tsx`) berisi countdown real-time (`components/CountdownTimer.tsx`) menuju `releaseDate`. Badge status tampil di card produk & halaman detail lewat `components/ProductStatusBadge.tsx`.
   - `"new-release"` / `"published"` → tombol beli berfungsi normal, langsung ke Payment Gateway (Midtrans) seperti biasa, hanya beda warna & label badge (New Release = oranye, Published = hijau).
   - **Cara ganti status/tanggal rilis:** edit `status` dan `releaseDate` (format ISO, mis. `"2026-09-20T09:00:00+07:00"`) langsung di `lib/data.ts` untuk tiap produk.
10. **Foto Portofolio Multi-Slide** — tiap project di `lib/data.ts` sekarang pakai field `images: string[]` (array, bukan satu foto lagi). Isi 1 atau lebih path foto per project — foto pertama otomatis jadi cover di grid, dan kalau lebih dari 1 foto, muncul badge "N foto" di pojok cover. Klik project untuk membuka `components/Lightbox.tsx` yang sekarang jadi carousel penuh: tombol panah kiri/kanan, indikator titik, navigasi keyboard (←/→/Esc), dan penghitung "1 / 3". Cara menambah foto: cukup tambahkan path baru ke array `images` project terkait, tidak perlu ubah komponen.
11. **Foto dari Google Drive** — selain file lokal di `public/images/`, foto juga bisa langsung dari Google Drive lewat helper `lib/gdrive.ts`:

    ```ts
    import { driveImageUrl } from "@/lib/gdrive";
    images: [driveImageUrl("https://drive.google.com/file/d/FILE_ID/view?usp=sharing")],
    ```

    **Wajib:** file di Drive di-share dengan akses "Anyone with the link" (role Viewer), kalau tidak foto tidak akan muncul. Cocok untuk testing/demo — untuk produksi jangka panjang, gunakan Vercel Blob (poin 12) yang lebih stabil.
12. **Upload Foto/Video via Vercel Blob (`/admin/upload`)** — cara paling praktis & stabil untuk menambah foto/video tanpa perlu redeploy kode, mendukung file besar (bukan cuma gambar kecil):
    - **Setup sekali saja:** buka dashboard Vercel → project ini → tab **Storage** → **Create Database** → pilih **Blob** → hubungkan ke project. Vercel otomatis mengisi env `BLOB_READ_WRITE_TOKEN`.
    - Tambahkan `UPLOAD_SECRET` (kata sandi bebas buatan sendiri) di Environment Variables Vercel.
    - Buka `https://domain-anda.com/admin/upload` (halaman internal, tidak muncul di navigasi maupun hasil pencarian Google), masukkan kata sandi, pilih file (gambar/video/PDF), klik Upload — ada progress bar untuk file besar.
    - URL hasil upload langsung muncul dengan tombol copy — tempel ke field yang sesuai di `lib/data.ts`.
    - **Cara kerja teknis:** memakai metode *client upload* Vercel Blob (`app/api/upload/route.ts` + `@vercel/blob/client`) — file dikirim **langsung dari browser ke Blob storage**, tidak lewat server kita. Ini yang membuatnya bisa menangani file sampai beberapa ratus MB/GB (bukan dibatasi 4.5 MB seperti upload lewat server biasa di Vercel). Batas default diset **500 MB** lewat `maximumSizeInBytes` di `app/api/upload/route.ts` — naikkan sendiri nilainya (maks. teoretis 5 TB) kalau perlu upload video yang lebih besar.
    - Tipe file yang diizinkan diatur di `allowedContentTypes` pada file yang sama (`app/api/upload/route.ts`) — saat ini: JPEG, PNG, WebP, SVG, MP4, MOV, WebM, PDF. Tambahkan tipe lain di array itu kalau perlu.
13. **Video Promosi Produk (`videoUrl`)** — tiap produk di `lib/data.ts` punya field opsional `videoUrl`. Isi dengan URL video langsung (mp4/webm — hasil upload lewat `/admin/upload` cocok dipakai di sini), contoh:

    ```ts
    videoUrl: "https://xxxxx.public.blob.vercel-storage.com/promo-eclass-abc123.mp4",
    ```

    Kalau diisi, otomatis muncul pemutar video ("Video Preview") di halaman detail produk, plus badge kecil "Video" di card produk pada grid Produk Digital. Kalau dikosongkan, section video tidak ditampilkan sama sekali — tidak wajib diisi untuk semua produk. **Catatan:** hanya mendukung file video langsung (mp4/webm), bukan link YouTube/Vimeo (beda cara embed-nya — kabari kalau butuh dukungan itu juga).
14. **Anggota Tim Baru** — daftar tim di `lib/data.ts` (array `team`) sekarang ada 4 orang, termasuk **Supriyatno (Site Analyst)**. Menambah anggota baru cukup tambahkan objek baru ke array ini (id unik, name, role, photo) — otomatis muncul di Footer, Floating WhatsApp Button, dropdown "Konsultasi Layanan Ini", dan grid Company Profile tanpa perlu ubah komponen lain.
15. **Upstash Redis untuk Order Management** — `lib/redis.ts` menyimpan data order (status, customer, token Midtrans) di Upstash Redis dengan TTL 90 hari. `api/checkout/notification/route.ts` sudah memanggil `saveOrder`/`updateOrder` saat menerima webhook Midtrans — tidak perlu database eksternal. Jika `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` tidak diisi, checkout tetap berjalan tapi status pesanan tidak tersimpan.
16. **Rate Limiting** — `lib/rate-limit.ts` membatasi frekuensi request ke API sensitif (`/api/testimoni`, `/api/checkout`). Jika Redis tersedia, dipakai algoritma *sliding window* via Upstash; jika tidak, fallback ke in-memory Map (aman untuk single-instance, tidak shared antar Vercel instance). Tidak perlu konfigurasi tambahan — aktif otomatis.
17. **SEO: Sitemap, Robots & Structured Data** — `app/sitemap.ts` menghasilkan `/sitemap.xml` dinamis (termasuk URL detail produk). `app/robots.ts` mengizinkan semua crawler kecuali `/admin/`. `components/OrganizationSchema.tsx` menyisipkan JSON-LD schema.org `Organization` di root layout untuk rich results Google. `public/llms.txt` menyediakan panduan ringkas untuk AI/LLM crawler.
18. **Google Analytics 4** — script GA4 dimuat via `app/layout.tsx` menggunakan `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Jika variabel tidak diisi, script tidak dimuat sama sekali (tidak ada error). Pemantauan pageview otomatis aktif tanpa konfigurasi tambahan.
19. **Before/After Slider (HeroCompare)** — `components/HeroCompare.tsx` menampilkan slider interaktif foto sebelum/sesudah renovasi di section Hero. Foto sumber diambil dari `public/images/compare-before.png` dan `public/images/compare-after.png` — ganti kedua file ini dengan foto proyek nyata sebelum go-live.

## Troubleshooting: Build Gagal "TypeError: Invalid URL"

Jika build di Vercel gagal dengan error `TypeError: Invalid URL` saat "Generating static pages" (biasanya menyebut `input: ''`), penyebabnya adalah `NEXT_PUBLIC_SITE_URL` belum diisi di Environment Variables Vercel. Variabel ini dipakai untuk `metadataBase` (dibutuhkan Next.js untuk membuat favicon dari `app/icon.svg`). **Wajib diisi dengan URL yang valid**, contoh: `https://dzaroza-property.vercel.app` atau domain kustom Anda — jangan dibiarkan kosong. Setelah diisi, klik **Redeploy** di tab Deployments.

## Tentang Peringatan `npm warn deprecated` Saat Build

Deretan pesan `npm warn deprecated ...` (inflight, rimraf, glob, uuid, @humanwhocodes/*, eslint@8.57.1) yang muncul di log Vercel **hanyalah peringatan, bukan error** — build tetap lanjut dan sukses. Semua itu adalah dependency transitif dari `eslint`/`eslint-config-next` versi lama, aman diabaikan.

Satu-satunya baris yang perlu ditindaklanjuti serius adalah:

```text
npm warn deprecated next@14.2.5: This version has a security vulnerability...
```

Ini **sudah diperbaiki** di proyek ini — `package.json` telah di-bump ke `next@16.3.5` (melampaui versi yang menambal CVE-2025-55183/55184/67779). `eslint-config-next` juga disamakan ke `16.3.5` agar kompatibel. Setelah upload ulang kode ini, warning tersebut tidak akan muncul lagi karena versi yang ter-install sudah versi aman.

 1. **Proteksi Akses Halaman Admin (`/admin/upload`)** — Menggunakan sistem keamanan ganda:
    - **Lapisan 1 (Layout Guard):** `app/admin/layout.tsx` memverifikasi sesi login Google pengguna via `getAdminSession()` di `lib/auth.ts`. Hanya alamat email yang terdaftar di variabel lingkungan `ADMIN_EMAILS` yang diizinkan mengakses halaman. Pengguna yang belum login atau tidak terdaftar otomatis dialihkan ke halaman sign-in.
    - **Lapisan 2 (Upload Secret):** Saat mengunggah file, form meminta kata sandi `UPLOAD_SECRET`. Sistem juga mendukung `UPLOAD_SECRET_PREVIOUS` untuk rotasi kunci berkala tanpa downtime.
 2. **Content Security Policy (CSP) & Header Keamanan Ketat** — Dikonfigurasi di `next.config.js` untuk melindungi website dari serangan XSS, clickjacking, dan injection. CSP mengizinkan domain-domain yang diperlukan: Midtrans (sandbox & live), Google APIs (OAuth, Sheets, Maps), Google Analytics, Vercel Blob, dan Google Drive. Header keamanan tambahan mencakup `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, dan `Referrer-Policy: strict-origin-when-cross-origin`.
 3. **Accordion FAQ Interaktif (`components/FAQ.tsx`)** — Menampilkan daftar pertanyaan yang sering diajukan di halaman utama. Seluruh daftar pertanyaan dan jawaban dikelola terpusat di array `faqs` pada `lib/data.ts`, sehingga penambahan atau revisi konten FAQ dapat dilakukan dengan cepat tanpa perlu memodifikasi komponen tampilan.
 4. **Halaman Kebijakan Privasi (`app/privasi/page.tsx`)** — Menyediakan informasi kepatuhan perlindungan data pribadi dan transparansi layanan sesuai persyaratan verifikasi Google OAuth, mencakup identitas usaha, pengumpulan data testimoni/pemesanan, hak pengguna, dan kontak resmi.

## Panduan Pengelolaan Konten (`lib/data.ts`)

Seluruh data konten web berada di satu file terpusat: `lib/data.ts`. Berikut cara memperbaruinya:

### Menambah Proyek Portofolio Baru

Tambahkan objek baru ke dalam array `portfolioProjects`:

```ts
{
  id: "7", // ID unik
  title: "Nama Proyek",
  categories: ["Eksterior", "Interior"], // "Interior" | "Eksterior"
  tag: "Bangunan Baru", // "Bangunan Baru" | "Renovasi Bangunan" | "Titip & Menjualkan"
  location: "Purbalingga, Jawa Tengah",
  year: "2026",
  images: [
    "/images/portfolio/nama-foto-01.jpg", // Foto pertama otomatis menjadi cover
    "/images/portfolio/nama-foto-02.jpg",
  ],
  description: "Deskripsi lengkap proyek...",
}
```

### Menambah atau Mengubah FAQ

Tambahkan objek pertanyaan & jawaban ke dalam array `faqs`:

```ts
{
  question: "Pertanyaan baru?",
  answer: "Jawaban penjelasan...",
}
```

### Mengubah Kontak & Media Sosial

Di bagian atas `lib/data.ts`:

- `primaryWhatsApp`: Ubah nomor WhatsApp resmi (format internasional tanpa tanda `+`, contoh: `"62882008562999"`).
- `instagramAccounts`: Daftar tautan akun Instagram resmi.
- `contactEmail`: Alamat email kontak resmi Dzaroza Property.

## Panduan Deployment ke Vercel

1. **Import Repository:** Hubungkan repository GitHub ini ke Vercel. Framework preset akan otomatis terdeteksi sebagai **Next.js**.
2. **Aktifkan Vercel Blob Storage:**
   - Di dashboard project Vercel, buka menu **Storage** → **Create Database** → pilih **Blob**.
   - Hubungkan Blob storage tersebut ke project ini (`BLOB_READ_WRITE_TOKEN` akan otomatis terpasang).
3. **Atur Environment Variables di Vercel:**
   - `NEXT_PUBLIC_SITE_URL`: Domain website Anda (misal `https://dzarozaproperty.id` atau `https://dzaroza-property.vercel.app`).
   - `NEXTAUTH_URL`: Domain yang sama dengan `NEXT_PUBLIC_SITE_URL`.
   - `NEXTAUTH_SECRET`: String acak aman (`openssl rand -base64 32`).
   - `ADMIN_EMAILS`: Email admin untuk izin akses `/admin/upload`.
   - `UPLOAD_SECRET`: Kata sandi upload untuk halaman internal `/admin/upload`.
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Kredensial OAuth Google.
   - `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`: Kredensial Google Sheets API untuk form testimoni.
   - `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`: Kredensial Midtrans Snap.
   - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Kredensial database Upstash Redis.
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`: ID Google Analytics (opsional).
4. **Daftarkan Webhook Midtrans:**
   - Buka dashboard Midtrans → **Settings** → **Configuration** → isi **Payment Notification URL** dengan:
     `https://domain-anda.com/api/checkout/notification`
5. **Jalankan Deployment:** Klik **Deploy**. Setelah proses selesai, website siap diakses.

## Daftar Perintah (Scripts)

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan lokal di `http://localhost:3000` |
| `npm run build` | Menjalankan proses kompilasi dan build produksi Next.js |
| `npm run start` | Menjalankan server produksi dari hasil build |
| `npm run lint` | Menjalankan pemeriksaan kode dan gaya penulisan menggunakan ESLint |
