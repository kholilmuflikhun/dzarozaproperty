# Dzaroza Property Platform

Monorepo untuk website publik Dzaroza Property, Project & Business Operating System, dan produk SaaS multi-tenant dengan subscription serta lisensi.

## Workspace

| Path | Fungsi |
|---|---|
| `apps/marketing` | Website publik existing, katalog, portofolio, order, testimoni dan SEO |
| `apps/ops` | Aplikasi operasional dan SaaS multi-tenant |
| `apps/worker` | Fondasi background processing |
| `packages/database` | Prisma ORM dan PostgreSQL schema/migrations |
| `packages/shared` | Shared domain contracts |

## Product continuity

Dzaroza Property OS dikembangkan sebagai satu produk berkelanjutan. Semua phase dan permintaan baru wajib memperluas fondasi yang ada, mempertahankan arsitektur, kontrak domain, identitas visual, navigasi, dan alur kerja yang sudah disepakati. Update harus kompatibel secara default; perubahan breaking atau arsitektural memerlukan ADR, analisis dampak, rencana migrasi/rollback, dan persetujuan eksplisit.

**Dokumen wajib:** [Engineering Governance](docs/ENGINEERING-GOVERNANCE.md). Dokumen tersebut menjadi acuan untuk semua pengembangan, review, Definition of Done, dan rilis dari phase awal sampai final.

## Prasyarat dan setup lokal

- Node.js 22+
- pnpm 10.18+
- PostgreSQL 16+

```bash
pnpm install
cp .env.example .env
cp apps/ops/.env.example apps/ops/.env.local
cp apps/marketing/.env.example apps/marketing/.env.local
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Isi Google OAuth dan Midtrans credentials hanya di environment lokal/Vercel. Google OAuth callback untuk Ops adalah `/api/auth/callback/google` pada host port 3001. Tambahkan `PLATFORM_ADMIN_EMAILS` untuk bootstrap email operator platform; nilai tersebut tidak boleh berasal dari input pengguna.

Jalankan aplikasi secara terpisah:

```bash
pnpm --filter @dzaroza/marketing dev
pnpm --filter @dzaroza/ops dev
```

## Deployment

Deployment saat ini tetap mempertahankan Vercel sebagai jalur rollback sampai migrasi Cloudflare tervalidasi. Buat project terpisah dari repository ini:
- Public website: Root Directory `apps/marketing`
- Business OS: Root Directory `apps/ops`

Gunakan workspace install root, aktifkan akses ke file workspace di luar root directory bila diminta, dan set environment variables pada project yang tepat. Worker background processing harus dideploy pada runtime yang mendukung proses persisten.

Target infrastruktur berikutnya adalah Cloudflare Workers untuk aplikasi, Cloudflare R2 untuk private object storage, Neon PostgreSQL tetap menjadi database, dan Jagoan Hosting tetap menjadi pengelola/registrar domain. Migrasi dilakukan bertahap melalui Preview; jangan mengubah DNS/nameserver atau domain production sebelum compatibility, E2E, rollback plan, dan persetujuan cutover lulus.

Lihat [Cloudflare Infrastructure Migration Plan](docs/INFRASTRUCTURE-MIGRATION-CLOUDFLARE.md) dan [ADR-0001](docs/adr/0001-cloudflare-platform-migration.md). Dokumen ini adalah rencana dan batas persetujuan, bukan klaim bahwa Worker atau DNS production telah dipindahkan.

## Security and SaaS model

- Setiap organisasi adalah tenant dan seluruh data bisnis harus di-scope dengan `organizationId`.
- Keanggotaan dan role diperiksa di server; ID organisasi dari browser tidak pernah menjadi bukti akses.
- Dzaroza internal menggunakan mekanisme tenant yang sama dengan pelanggan.
- Plan, harga bulanan/tahunan, limit dan feature entitlements dikendalikan database.
- Subscription hanya aktif dari webhook pembayaran tervalidasi atau tindakan admin yang diaudit.
- Midtrans Snap pada tahap ini adalah checkout satu-periode; jangan menganggap auto-debit recurring sudah aktif.
- License key dibuat acak, disimpan sebagai hash dan ditampilkan satu kali. License key bukan pengganti autentikasi.
- Status langganan kedaluwarsa membatasi fitur sesuai entitlement; data pelanggan tidak otomatis dihapus.

## Quality gates

GitHub Actions menjalankan install, generate Prisma client, schema validation, database migration, typecheck, unit tests dan production builds. Workflow mengunggah lockfile pnpm dan initial migration yang dihasilkan sebagai artifact agar dapat ditinjau dan dikomit setelah hasil CI diverifikasi.

Phase tidak dianggap selesai hanya karena implementasi atau CI lama berhasil. Gunakan Definition of Done dalam [Engineering Governance](docs/ENGINEERING-GOVERNANCE.md), dan verifikasi workflow pada commit PR terkini, Preview deployment, migration history, security/integration checks, serta UAT.

Lihat [Implementation Record](docs/IMPLEMENTATION.md) untuk arsitektur, migration plan, autentikasi, isolasi tenant, billing, lisensi, dan exit criteria.

## Product direction

Dzaroza Property OS dikembangkan sebagai platform Managerial Property yang dapat digunakan internal dan dipasarkan sebagai SaaS multi-tenant dengan lisensi serta langganan bulanan/tahunan. Lihat [Managerial Property Product Direction](docs/MANAGERIAL-PROPERTY-PRODUCT-DIRECTION.md) untuk UX, domain roadmap, model penggunaan, lisensi dan acceptance requirements. Fitur roadmap tidak dianggap tersedia sebelum implementasi dan validasi fase terkait selesai.
