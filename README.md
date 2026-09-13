# Dzaroza Property — Company Profile, Portofolio & Penjualan Produk Digital

Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion + NextAuth.js (Google Login) + Google Sheets API.

## Menjalankan Proyek

```bash
npm install
cp .env.example .env.local   # isi kredensial (lihat bawah)
npm run dev
```

Buka http://localhost:3000

## Struktur Proyek

```
dzaroza-property/
├── app/
│   ├── layout.tsx                                  # Root layout: Providers (NextAuth), Navbar, Footer, Floating WA
│   ├── page.tsx                                    # Halaman utama — semua section
│   ├── not-found.tsx
│   ├── globals.css
│   ├── produk/[slug]/page.tsx                      # Detail produk digital (/produk/e-book, /produk/e-class)
│   └── api/
│       ├── auth/[...nextauth]/route.ts             # Google Login (NextAuth)
│       └── testimoni/route.ts                      # POST/GET testimoni ⇄ Google Sheets
├── components/
│   ├── Navbar.tsx                                  # smooth scroll anchor ("auto section jump")
│   ├── Footer.tsx                                  # WA per anggota tim + IG + email
│   ├── FloatingWhatsApp.tsx                        # tombol WA melayang, expand ke 3 kontak tim
│   ├── Hero.tsx                                    # tagline properti Islami/amanah + Framer Motion
│   ├── Products.tsx                                # E-Book & E-Class + PurchaseButton
│   ├── PurchaseButton.tsx                          # dropdown: Payment Gateway vs WhatsApp
│   ├── Services.tsx                                # 3 kategori jasa + penekanan teks syariah
│   ├── Portfolio.tsx                               # filter (useState) + tag + lightbox
│   ├── Lightbox.tsx                                # modal foto reusable (portofolio & tim)
│   ├── Testimonials.tsx                            # grid review, fetch dari /api/testimoni
│   ├── TestimoniForm.tsx                           # Login with Google + form alamat/HP/email/review
│   ├── CompanyProfile.tsx                          # sejarah, visi-misi, nilai, grid tim + lightbox
│   ├── Providers.tsx                               # SessionProvider (NextAuth)
│   └── SectionHeading.tsx
├── lib/
│   ├── data.ts                                     # semua data statis (produk, jasa, portofolio, tim, testimoni)
│   └── auth.ts                                     # authOptions NextAuth (Google Provider)
├── types/next-auth.d.ts                            # perluasan tipe session.user.id
├── public/images/{portfolio,team,products}/*.svg   # placeholder lokal (offline-safe)
├── tailwind.config.ts
└── package.json
```

## Kredensial yang Perlu Diisi (`.env.local`)

| Variabel | Untuk apa | Cara dapatkan |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login with Google di form testimoni | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), buat OAuth Client ID tipe "Web application", redirect URI: `http://localhost:3000/api/auth/callback/google` |
| `NEXTAUTH_SECRET` | Enkripsi sesi NextAuth | `openssl rand -base64 32` |
| `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` | Kirim data testimoni ke Google Sheets | Buat Service Account di Google Cloud Console → aktifkan **Google Sheets API** → generate JSON key |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID spreadsheet tujuan | Ambil dari URL sheet: `docs.google.com/spreadsheets/d/**ID_INI**/edit` — lalu **share** sheet ke email service account (role Editor) |
| `MIDTRANS_SERVER_KEY` dll | (Opsional) aktifkan opsi "Payment Gateway" pada tombol beli | [dashboard.midtrans.com](https://dashboard.midtrans.com) |

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
6. **Logo placeholder** — `public/images/logo.svg` (versi gelap, dipakai di Navbar) dan `public/images/logo-white.svg` (versi terang, dipakai di Footer) menggantikan ikon+teks lama. Favicon di `app/icon.svg` juga sudah pakai mark yang sama. Ganti ketiga file ini dengan logo asli sebelum go-live — path tetap sama, tidak perlu ubah kode.
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
14. **Anggota Tim Baru** — daftar tim di `lib/data.ts` (array `team`) sekarang ada 4 orang, termasuk **Supriyatno (Pengawas Lapangan)**. Menambah anggota baru cukup tambahkan objek baru ke array ini (id unik, name, role, photo, whatsapp) — otomatis muncul di Footer, Floating WhatsApp Button, dropdown "Konsultasi Layanan Ini", dan grid Company Profile tanpa perlu ubah komponen lain.

## Troubleshooting: Build Gagal "TypeError: Invalid URL"

Jika build di Vercel gagal dengan error `TypeError: Invalid URL` saat "Generating static pages" (biasanya menyebut `input: ''`), penyebabnya adalah `NEXT_PUBLIC_SITE_URL` belum diisi di Environment Variables Vercel. Variabel ini dipakai untuk `metadataBase` (dibutuhkan Next.js untuk membuat favicon dari `app/icon.svg`). **Wajib diisi dengan URL yang valid**, contoh: `https://dzaroza-property.vercel.app` atau domain kustom Anda — jangan dibiarkan kosong. Setelah diisi, klik **Redeploy** di tab Deployments.

## Tentang Peringatan `npm warn deprecated` Saat Build

Deretan pesan `npm warn deprecated ...` (inflight, rimraf, glob, uuid, @humanwhocodes/*, eslint@8.57.1) yang muncul di log Vercel **hanyalah peringatan, bukan error** — build tetap lanjut dan sukses. Semua itu adalah dependency transitif dari `eslint`/`eslint-config-next` versi lama, aman diabaikan.

Satu-satunya baris yang perlu ditindaklanjuti serius adalah:
```
npm warn deprecated next@14.2.5: This version has a security vulnerability...
```
Ini **sudah diperbaiki** di proyek ini — `package.json` telah di-bump ke `next@14.2.35` (versi resmi yang menambal CVE-2025-55183/55184/67779, lihat [nextjs.org/blog/security-update-2025-12-11](https://nextjs.org/blog/security-update-2025-12-11)). `eslint-config-next` juga disamakan ke `14.2.35` agar kompatibel. Setelah upload ulang kode ini, warning tersebut tidak akan muncul lagi karena versi yang ter-install sudah versi aman.
