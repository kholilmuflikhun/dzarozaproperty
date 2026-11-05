"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Building2, Plus, RefreshCw, MapPin, Layers3, Home, Package } from "lucide-react";
import Link from "next/link";

type Property = {
  id: string; code: string; name: string; propertyType: string; status: string;
  city?: string | null; province?: string | null; addressLine?: string | null;
  _count?: { buildings: number; units: number; assets: number };
};
const types = [
  ["RESIDENTIAL","Perumahan"],["APARTMENT","Apartemen"],["COMMERCIAL","Komersial"],
  ["INDUSTRIAL","Industri"],["MIXED_USE","Campuran"],["LAND","Tanah"],["OTHER","Lainnya"],
] as const;
const statusLabel: Record<string,string> = { DRAFT:"Draft", ACTIVE:"Aktif", INACTIVE:"Tidak aktif", ARCHIVED:"Arsip" };

export default function PropertiesPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [properties,setProperties] = useState<Property[]>([]);
  const [code,setCode] = useState("");
  const [name,setName] = useState("");
  const [propertyType,setPropertyType] = useState("RESIDENTIAL");
  const [city,setCity] = useState("");
  const [search,setSearch] = useState("");
  const [activeSearch,setActiveSearch] = useState("");
  const [nextCursor,setNextCursor] = useState<string | null>(null);
  const [loadingMore,setLoadingMore] = useState(false);
  const [province,setProvince] = useState("");
  const [addressLine,setAddressLine] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const base = `/api/organizations/${encodeURIComponent(organizationId)}`;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ limit: "24" });
      if (activeSearch) query.set("q", activeSearch);
      const response = await fetch(`${base}/properties?${query.toString()}`,{cache:"no-store"});
      const payload = await response.json();
      if(!response.ok) throw new Error(payload.error ?? "Gagal memuat portofolio properti.");
      setProperties(payload.properties ?? []);
      setNextCursor(payload.pagination?.nextCursor ?? null);
    } catch(e) { setError(e instanceof Error ? e.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  },[base,activeSearch]);
  useEffect(()=>{void load()},[load]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError("");
    try {
      const query = new URLSearchParams({ limit: "24", cursor: nextCursor });
      if (activeSearch) query.set("q", activeSearch);
      const response = await fetch(`${base}/properties?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Gagal memuat halaman berikutnya.");
      setProperties((current) => [...current, ...(payload.properties ?? [])]);
      setNextCursor(payload.pagination?.nextCursor ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat halaman berikutnya."); }
    finally { setLoadingMore(false); }
  }

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${base}/properties`,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({code,name,propertyType,city:city||null,province:province||null,addressLine:addressLine||null}),
      });
      const payload = await response.json();
      if(!response.ok) throw new Error(payload.error ?? "Properti gagal dibuat.");
      setNotice(`Properti ${payload.property.code} berhasil ditambahkan.`);
      setCode("");setName("");setCity("");setProvince("");setAddressLine("");
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Properti gagal dibuat."); }
    finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">Property Management</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">Portofolio Properti</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">Pusat data kawasan, gedung, unit, dan aset yang dikelola organisasi. Setiap properti memiliki ruang data terpisah dan dapat dikembangkan bertahap.</p></div>
      <button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700"><RefreshCw size={16}/> Muat ulang</button>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Plus size={20}/></span><div><h2 className="font-semibold text-neutral-950">Daftarkan properti</h2><p className="text-xs text-neutral-500">Data dasar dapat dilengkapi lebih lanjut setelah properti dibuat.</p></div></div>
      <form onSubmit={createProperty} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium text-neutral-700">Kode properti<input required minLength={2} maxLength={32} value={code} onChange={e=>setCode(e.target.value)} placeholder="PROP-001" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal"/></label>
        <label className="text-sm font-medium text-neutral-700">Nama properti<input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="Perumahan Harmoni" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal"/></label>
        <label className="text-sm font-medium text-neutral-700">Jenis properti<select value={propertyType} onChange={e=>setPropertyType(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm font-normal">{types.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-neutral-700">Alamat<input maxLength={500} value={addressLine} onChange={e=>setAddressLine(e.target.value)} placeholder="Jalan, nomor, kawasan" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal"/></label>
        <label className="text-sm font-medium text-neutral-700">Kota/Kabupaten<input maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder="Banyumas" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal"/></label>
        <label className="text-sm font-medium text-neutral-700">Provinsi<input maxLength={120} value={province} onChange={e=>setProvince(e.target.value)} placeholder="Jawa Tengah" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal"/></label>
        <div className="sm:col-span-2 lg:col-span-3"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50">{saving?"Menyimpan…": "Simpan properti"}</button></div>
      </form>
    </section>
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold text-neutral-950">Daftar properti</h2><p className="mt-1 text-sm text-neutral-500">Ringkasan jumlah gedung, unit, dan aset terdaftar.</p></div>
        <form onSubmit={(event)=>{event.preventDefault();setActiveSearch(search.trim());}} className="flex w-full gap-2 sm:w-auto">
          <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Cari kode, nama, kota…" aria-label="Cari properti" className="min-h-10 min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 text-sm sm:w-64"/>
          <button className="min-h-10 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-700">Cari</button>
          {activeSearch && <button type="button" onClick={()=>{setSearch("");setActiveSearch("");}} className="min-h-10 rounded-xl px-3 text-sm text-neutral-500">Reset</button>}
        </form>
      </div>
      <div className="mb-4 flex justify-end"><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{properties.length} properti dimuat</span></div>
      {loading?<p className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Memuat portofolio…</p>:properties.length===0?<div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center"><Building2 className="mx-auto text-neutral-300" size={34}/><p className="mt-3 font-semibold text-neutral-800">Belum ada properti</p><p className="mt-1 text-sm text-neutral-500">Daftarkan properti pertama untuk mulai membangun portofolio.</p></div>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {properties.map(property=><article key={property.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold tracking-wide text-orange-600">{property.code}</p><h3 className="mt-1 truncate font-semibold text-neutral-950">{property.name}</h3><p className="mt-1 text-xs text-neutral-500">{types.find(([v])=>v===property.propertyType)?.[1]??property.propertyType}</p></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">{statusLabel[property.status]??property.status}</span></div>
          {(property.city||property.province||property.addressLine)&&<p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-500"><MapPin size={14} className="mt-0.5 shrink-0"/>{[property.addressLine,property.city,property.province].filter(Boolean).join(", ")}</p>}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-4">
            <div><p className="flex items-center gap-1 text-[10px] text-neutral-400"><Layers3 size={12}/> Gedung</p><p className="mt-1 text-lg font-bold text-neutral-900">{property._count?.buildings??0}</p></div>
            <div><p className="flex items-center gap-1 text-[10px] text-neutral-400"><Home size={12}/> Unit</p><p className="mt-1 text-lg font-bold text-neutral-900">{property._count?.units??0}</p></div>
            <div><p className="flex items-center gap-1 text-[10px] text-neutral-400"><Package size={12}/> Aset</p><p className="mt-1 text-lg font-bold text-neutral-900">{property._count?.assets??0}</p></div>
          </div>
          <Link href={`/dashboard/${encodeURIComponent(organizationId)}/properties/${encodeURIComponent(property.id)}`} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-orange-300 hover:text-orange-700">Lihat detail properti</Link>
        </article>)}
      </div>}
      {!loading && nextCursor && <div className="mt-5 text-center"><button type="button" onClick={()=>void loadMore()} disabled={loadingMore} className="min-h-11 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-50">{loadingMore ? "Memuat…" : "Muat lebih banyak"}</button></div>}
    </section>
  </main>;
}
