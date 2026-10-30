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
 return <main className="min-h-screen px-5 py-8 md:px-10"><div className="mx-auto max-w-5xl"><Link href="/dashboard" className="text-sm font-semibold text-blue-700">← Semua organisasi</Link><h1 className="mt-5 text-3xl font-bold">{organization.name}</h1><p className="mt-2 text-sm text-slate-600">Role Anda: {membership.role}. Workspace tenant telah diverifikasi di server.</p><div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Fondasi workspace</h2><p className="mt-2 text-sm leading-6 text-slate-600">Tenant context: {organization.id}. Modul CRM, proyek dan keuangan akan ditambahkan setelah quality gate Phase 1 terpenuhi.</p><p className="mt-3 text-xs text-slate-500">Mata uang: {organization.currency} · Zona waktu: {organization.timezone}</p></div></div></main>;
}
