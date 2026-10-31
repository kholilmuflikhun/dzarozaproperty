import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { getDashboardData } from "./actions";
import { CreateOrganizationForm } from "./create-organization-form";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const { user, memberships } = await getDashboardData();
  return <main className="min-h-screen px-5 py-8 md:px-10"><div className="mx-auto max-w-5xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Dzaroza Property OS</p><h1 className="mt-1 text-2xl font-bold">Organisasi Anda</h1><p className="mt-1 text-sm text-slate-600">{user.email}</p></div><SignOutButton/></header>
    <section className="py-8"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ShieldCheck size={18} className="text-emerald-600"/>Akses berdasarkan keanggotaan organisasi</div><p className="mt-2 text-sm leading-6 text-slate-600">Login tidak otomatis memberi akses ke data perusahaan. Anda hanya dapat membuka organisasi tempat akun Anda terdaftar.</p></section>
    <section className="grid gap-4 md:grid-cols-2">{memberships.map(({organization,role})=><article key={organization.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Building2/></div><div><h2 className="font-semibold">{organization.name}</h2><p className="text-xs text-slate-500">{role}</p></div></div><Link href={`/dashboard/${organization.id}`} className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Buka workspace</Link></article>)}</section>
    {memberships.length===0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Belum ada organisasi. Buat organisasi baru atau minta administrator mengundang akun Anda.</p>}
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Buat organisasi</h2><p className="mt-1 text-sm text-slate-600">Akun pembuat otomatis menjadi Owner organisasi.</p><CreateOrganizationForm/></section>
  </div></main>;
}
