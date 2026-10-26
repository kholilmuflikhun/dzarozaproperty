# Panduan Konfigurasi `.env.local`

Panduan ini menjelaskan konfigurasi lokal untuk menjalankan dan menguji aplikasi. File `.env.local` berisi kredensial dan secret, jadi **jangan dibagikan atau di-commit ke Git**.

## 1. Konfigurasikan Upstash Redis

Checkout membutuhkan Redis untuk menyimpan data order. Tanpa konfigurasi Redis, endpoint checkout akan mengembalikan status `503`.

1. Buat database Redis di [Upstash Console](https://console.upstash.com/).
2. Buka database tersebut, lalu salin **REST URL** dan **REST Token**.
3. Tambahkan nilainya ke `.env.local`:

```env
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

Gunakan database development terpisah dari production jika memungkinkan. Environment di Vercel harus dikonfigurasi secara terpisah.

## 2. Buat `UPLOAD_SECRET` yang kuat

Buat secret acak minimal 32 karakter. Jika Node.js tersedia, jalankan perintah berikut di PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Salin hasilnya ke `.env.local`:

```env
UPLOAD_SECRET="tempel-hasil-secret-di-sini"
```

Jangan gunakan teks contoh di atas sebagai secret sebenarnya. Jika sedang merotasi secret dan admin masih membutuhkan secret lama, simpan sementara di `UPLOAD_SECRET_PREVIOUS`. Jika tidak, variabel tersebut boleh dikosongkan.

## 3. Atur URL lokal

Untuk menjalankan aplikasi di komputer sendiri, atur kedua URL berikut ke localhost:

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
```

Saat deployment, atur keduanya ke domain production yang benar, misalnya:

```env
NEXT_PUBLIC_SITE_URL="https://domain-anda"
NEXTAUTH_URL="https://domain-anda"
```

Jika menggunakan Google OAuth, tambahkan redirect URI yang sesuai di konfigurasi OAuth Google. Untuk pengembangan lokal, biasanya:

```text
http://localhost:3000/api/auth/callback/google
```

## 4. Gunakan Midtrans Sandbox untuk pengujian

Untuk pengujian pembayaran lokal, gunakan kredensial Midtrans **sandbox**. Pastikan kedua variabel mode sama-sama `"false"`:

```env
MIDTRANS_IS_PRODUCTION="false"
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION="false"
```

Jangan melakukan transaksi uji dengan mode live.

## 5. Muat ulang aplikasi

Setelah mengubah `.env.local`, hentikan server development jika sedang berjalan, lalu jalankan kembali:

```powershell
npm run dev
```

Next.js membaca variabel lingkungan saat server dimulai, sehingga perubahan tidak selalu diterapkan sampai server direstart.
