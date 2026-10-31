import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@dzaroza/database";
import { requireTenantContext } from "@/lib/tenant";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

export default async function OrganizationDashboard({params}:{params:Promise<{organizationId:string}>}){
 const {organizationId}=await params;
 let membership;
 try{membership=await requireTenantContext(organizationId);}catch(error){if(error instanceof UnauthorizedError)redirect("/login");if(error instanceof ForbiddenError)notFound();throw error;}
 const organization=await prisma.organization.findUnique({where:{id:membership.organizationId},select:{id:true,name:true,currency:true,timezone:true}});
 if(!organization)notFound();
 return <main className="min-h-screen px-5 py-8 md:px-10"><div className="mx-auto max-w-5xl"><Link href="/dashboard" className="text-sm font-semibold text-blue-700">← Semua organisasi</Link><h1 className="mt-5 text-3xl font-bold">{organization.name}</h1><p className="mt-2 text-sm text-slate-600">Role Anda: {membership.role}. Workspace tenant telah diverifikasi di server.</p><div className="mt-8 grid gap-4 md:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Fondasi workspace</h2><p className="mt-2 text-sm leading-6 text-slate-600">Tenant context: {organization.id}. Seluruh modul operasional dibatasi oleh keanggotaan organisasi.</p><p className="mt-3 text-xs text-slate-500">Mata uang: {organization.currency} · Zona waktu: {organization.timezone}</p></section><Link href={`/dashboard/${organization.id}/finance`} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Phase 2 · Finance</p><h2 className="mt-2 text-xl font-semibold">Dashboard Keuangan</h2><p className="mt-2 text-sm leading-6 text-slate-600">Pantau penerimaan, pengeluaran, arus kas bersih, piutang dan tren enam bulan.</p><span className="mt-4 inline-flex text-sm font-semibold text-blue-700">Buka dashboard →</span></Link></div></div></main>;
}
