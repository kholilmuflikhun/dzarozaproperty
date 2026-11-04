import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getDashboardData } from "./actions";
import { CreateOrganizationForm } from "./create-organization-form";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const { user, memberships } = await getDashboardData();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <span className="flex size-11 items-center justify-center rounded-xl bg-blue-700 text-white">
              <Building2 size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight">DZAROZA</span>
              <span className="block text-xs text-slate-500">Property Operating System</span>
            </span>
          </Link>
          <SignOutButton />
        </header>

        <section className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white shadow-sm md:mt-10 md:px-10 md:py-10">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                <Sparkles size={14} aria-hidden="true" />
                Property management workspace
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight md:text-3xl">
                Selamat datang kembali.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Pilih organisasi untuk melanjutkan pekerjaan. Setiap workspace memiliki
                data, anggota, dan hak akses yang terpisah.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                Akun aktif
              </p>
              <p className="mt-1 max-w-[240px] truncate text-sm font-semibold text-white">
                {user.email}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
                Workspace Anda
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                Pilih organisasi
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Buka workspace sesuai organisasi yang ingin Anda kelola.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              {memberships.length} organisasi
            </span>
          </div>

          {memberships.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {memberships.map(({ organization, role }) => (
                <article
                  key={organization.id}
                  className="group flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Building2 size={21} aria-hidden="true" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600">
                      {role.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-950">
                    {organization.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Workspace organisasi
                  </p>
                  <Link
                    href={`/dashboard/${organization.id}`}
                    className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    Buka workspace
                    <ArrowRight size={16} className="transition group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Building2 size={23} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                Belum ada organisasi
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Buat organisasi pertama Anda atau minta administrator mengundang akun
                ini ke workspace yang sudah tersedia.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Plus size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Buat organisasi baru
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Siapkan workspace terpisah untuk perusahaan atau unit bisnis baru.
                Akun pembuat otomatis menjadi Owner organisasi.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-5">
            <CreateOrganizationForm />
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-900">
          <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />
          <span>
            Keamanan tenant aktif: Anda hanya dapat mengakses organisasi tempat akun
            Anda terdaftar sebagai anggota.
          </span>
        </div>

        <footer className="mt-10 border-t border-slate-200 py-5 text-xs text-slate-400">
          Dzaroza Property OS · Workspace operasional properti
        </footer>
      </div>
    </main>
  );
}
