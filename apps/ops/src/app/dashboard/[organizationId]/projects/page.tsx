"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, Plus, RefreshCw } from "lucide-react";

type Client = { id: string; name: string; phone?: string | null };
type Project = { id: string; code: string; name: string; status: string; progress: number; contractValue: string | number; updatedAt: string; client: Client };
const money = (value: string | number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const statusLabels: Record<string,string> = { DRAFT:"Draft", QUOTATION:"Penawaran", WAITING_APPROVAL:"Menunggu persetujuan", SCHEDULED:"Terjadwal", IN_PROGRESS:"Berjalan", ON_HOLD:"Ditunda", HANDOVER:"Serah terima", COMPLETED:"Selesai", CANCELED:"Dibatalkan", ARCHIVED:"Arsip" };

export default function ProjectsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [projects,setProjects] = useState<Project[]>([]);
  const [clients,setClients] = useState<Client[]>([]);
  const [clientId,setClientId] = useState("");
  const [code,setCode] = useState("");
  const [name,setName] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const base = `/api/organizations/${encodeURIComponent(organizationId)}`;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [projectResponse,clientResponse] = await Promise.all([fetch(`${base}/projects`,{cache:"no-store"}),fetch(`${base}/clients`,{cache:"no-store"})]);
      const [projectPayload,clientPayload] = await Promise.all([projectResponse.json(),clientResponse.json()]);
      if(!projectResponse.ok) throw new Error(projectPayload.error ?? "Gagal memuat proyek.");
      if(!clientResponse.ok) throw new Error(clientPayload.error ?? "Gagal memuat klien.");
      setProjects(projectPayload.projects ?? []); setClients(clientPayload.clients ?? []);
    } catch(e) { setError(e instanceof Error ? e.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  },[base]);
  useEffect(()=>{void load()},[load]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response=await fetch(`${base}/projects`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId,code,name,contractValue:0})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error ?? "Proyek gagal dibuat.");
      setNotice(`Proyek ${payload.project.code} berhasil dibuat. Lengkapi rincian pekerjaan pada workspace.`);
      setCode(""); setName(""); await load();
    } catch(e) {setError(e instanceof Error?e.message:"Proyek gagal dibuat.");}
    finally {setSaving(false);}
  }

  return <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Project Management</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Manajemen Proyek</h1><p className="mt-2 text-sm text-slate-500">Kelola data proyek, rincian pekerjaan, termin, progres, dan dokumen dalam satu workspace.</p></div>
      <button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw size={16}/> Muat ulang</button>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Plus size={20}/></div><div><h2 className="font-semibold text-slate-950">Buat proyek baru</h2><p className="text-xs text-slate-500">Pilih klien atau daftarkan klien terlebih dahulu melalui CRM.</p></div></div>
      <form onSubmit={createProject} className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Klien
          <select required value={clientId} onChange={e=>setClientId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"><option value="">Pilih klien</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone? ` · ${c.phone}`:""}</option>)}</select>
        </label>
        <label className="text-sm font-medium text-slate-700">Kode proyek
          <input required minLength={2} maxLength={32} value={code} onChange={e=>setCode(e.target.value)} placeholder="PRJ-2026-001" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-normal"/>
        </label>
        <label className="text-sm font-medium text-slate-700">Nama proyek
          <input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="Renovasi rumah tinggal" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-normal"/>
        </label>
        <div className="md:col-span-3"><button disabled={saving || clients.length===0} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?"Menyimpan…":"Buat workspace proyek"}</button>{clients.length===0 && <p className="mt-2 text-xs text-amber-700">Belum ada klien. Tambahkan klien melalui modul CRM sebelum membuat proyek.</p>}</div>
      </form>
    </section>
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Daftar proyek</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{projects.length} proyek</span></div>
      {loading?<p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Memuat proyek…</p>:projects.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><BriefcaseBusiness className="mx-auto text-slate-300" size={32}/><p className="mt-3 font-semibold text-slate-800">Belum ada proyek</p><p className="mt-1 text-sm text-slate-500">Buat proyek pertama untuk memulai alur dokumen otomatis.</p></div>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map(project=><Link key={project.id} href={`/dashboard/${organizationId}/projects/${project.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold tracking-wide text-blue-700">{project.code}</p><h3 className="mt-1 truncate font-semibold text-slate-950">{project.name}</h3><p className="mt-1 text-xs text-slate-500">{project.client?.name ?? "Klien"}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{statusLabels[project.status]??project.status}</span></div>
          <div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span>Nilai dasar</span><strong className="text-sm text-slate-900">{money(project.contractValue)}</strong></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${project.progress}%`}}/></div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>Progres pekerjaan</span><strong>{project.progress}%</strong></div>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Buka workspace <ArrowRight size={15} className="transition-transform group-hover:translate-x-1"/></span>
        </Link>)}
      </div>}
    </section>
  </main>;
}
