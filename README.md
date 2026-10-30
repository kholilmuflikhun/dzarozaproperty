# Dzaroza Property Platform

Monorepo untuk website publik, Project & Business Operating System, dan produk SaaS berlisensi.

## Workspace
- `apps/marketing`: website publik existing, katalog, portofolio, order, testimoni.
- `apps/ops`: aplikasi Project & Business Operating System multi-tenant.
- `apps/worker`: fondasi background worker.
- `packages/database`: PostgreSQL + Prisma.
- `packages/shared`: shared domain contracts.

## Setup
Node.js 22+, pnpm 10+, PostgreSQL.

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

Jalankan satu aplikasi: `pnpm --filter @dzaroza/marketing dev` atau `pnpm --filter @dzaroza/ops dev`.

## Vercel
Buat dua project: marketing dengan Root Directory `apps/marketing`, OS dengan Root Directory `apps/ops`. Gunakan workspace install root dan konfigurasi environment masing-masing. Worker harus berjalan pada runtime yang mendukung proses persisten.

## SaaS rules
Tenant pelanggan dan Dzaroza internal memakai aturan keamanan yang sama. Plan, harga, limit, feature entitlement, masa berlangganan dan lisensi dikendalikan dari database. Siklus bulanan/tahunan didukung; nominal harga tidak di-hardcode. Subscription hanya aktif dari pembayaran terverifikasi atau tindakan admin yang diaudit. License key disimpan sebagai hash dan tidak menggantikan autentikasi.

## Status
Ini adalah scaffold migrasi dan fondasi, bukan klaim bahwa seluruh Phase 0–8 telah selesai. Lihat `docs/IMPLEMENTATION.md` untuk arsitektur, model lisensi, roadmap, dan kriteria penyelesaian.
