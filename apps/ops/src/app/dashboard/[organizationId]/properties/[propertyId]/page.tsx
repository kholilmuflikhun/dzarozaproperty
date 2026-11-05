"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Home, Package, RefreshCw, Archive, Save } from "lucide-react";

type Building = { id: string; code: string; name: string; status: string; floors: number | null };
type Unit = { id: string; code: string; name: string | null; unitType: string; status: string; building?: { name: string; code: string } | null };
type Asset = { id: string; code: string; name: string; category: string; status: string; building?: { name: string; code: string } | null };
type Property = {
  id: string; code: string; name: string; propertyType: string; status: string;
  description: string | null; addressLine: string | null; village: string | null; district: string | null;
  city: string | null; province: string | null; postalCode: string | null; country: string;
  landArea: string | number | null; buildingArea: string | number | null;
  buildings: Building[]; units: Unit[]; assets: Asset[];
};

const labels: Record<string, string> = {
  RESIDENTIAL: "Perumahan", APARTMENT: "Apartemen", COMMERCIAL: "Komersial",
  INDUSTRIAL: "Industri", MIXED_USE: "Campuran", LAND: "Tanah", OTHER: "Lainnya",
  DRAFT: "Draft", ACTIVE: "Aktif", INACTIVE: "Tidak aktif", ARCHIVED: "Arsip",
};

export default function PropertyDetailPage() {
  const params = useParams<{ organizationId: string; propertyId: string }>();
  const router = useRouter();
  const base = `/api/organizations/${encodeURIComponent(params.organizationId)}/properties/${encodeURIComponent(params.propertyId)}`;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(base, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Gagal memuat detail properti.");
      setProperty(payload.property);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat detail properti.");
    } finally { setLoading(false); }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) return;
    setSaving(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((value, key) => { payload[key] = value; });
    for (const key of ["landArea", "buildingArea"]) {
      const value = payload[key];
      payload[key] = typeof value === "string" && value.trim() !== "" ? Number(value) : null;
    }
    for (const key of ["description", "addressLine", "village", "district", "city", "province", "postalCode"]) {
      if (payload[key] === "") payload[key] = null;
    }
    try {
      const response = await fetch(base, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Perubahan properti gagal disimpan.");
      setNotice("Perubahan properti berhasil disimpan.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Perubahan properti gagal disimpan.");
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!window.confirm("Arsipkan properti ini? Data tidak dihapus, tetapi properti tidak lagi aktif.")) return;
    setArchiving(true); setError(""); setNotice("");
    try {
      const response = await fetch(base, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Properti gagal diarsipkan.");
      router.push(`/dashboard/${encodeURIComponent(params.organizationId)}/properties`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Properti gagal diarsipkan.");
    } finally { setArchiving(false); }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-500">Memuat detail properti…</main>;
  if (!property) return <main className="mx-auto max-w-7xl px-4 py-8"><Link href={`/dashboard/${params.organizationId}/properties`} className="text-sm text-blue-700">Kembali ke portofolio</Link><p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error || "Properti tidak ditemukan."}</p></main>;

  return <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
    <Link href={`/dashboard/${params.organizationId}/properties`} className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-950"><ArrowLeft size={16}/> Kembali ke portofolio</Link>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">Property Portfolio / Detail</p><h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">{property.name}</h1><p className="mt-1 text-sm text-neutral-500">{property.code} · {labels[property.propertyType] ?? property.propertyType} · {labels[property.status] ?? property.status}</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700"><RefreshCw size={16}/> Muat ulang</button>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <Summary icon={<Building2 size={18}/>} label="Gedung" value={property.buildings.length}/>
      <Summary icon={<Home size={18}/>} label="Unit" value={property.units.length}/>
      <Summary icon={<Package size={18}/>} label="Aset" value={property.assets.length}/>
    </div>
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-neutral-950">Informasi properti</h2>
      <p className="mt-1 text-sm text-neutral-500">Perbarui identitas, lokasi, dan luas properti. Perubahan dicatat dalam audit trail.</p>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Kode properti" name="code" defaultValue={property.code} required/>
        <Field label="Nama properti" name="name" defaultValue={property.name} required/>
        <label className="text-sm font-medium text-neutral-700">Jenis properti<select name="propertyType" defaultValue={property.propertyType} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm">{Object.entries({RESIDENTIAL:"Perumahan",APARTMENT:"Apartemen",COMMERCIAL:"Komersial",INDUSTRIAL:"Industri",MIXED_USE:"Campuran",LAND:"Tanah",OTHER:"Lainnya"}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-neutral-700">Status<select name="status" defaultValue={property.status} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"><option value="DRAFT">Draft</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select></label>
        <Field label="Alamat" name="addressLine" defaultValue={property.addressLine ?? ""}/>
        <Field label="Desa/Kelurahan" name="village" defaultValue={property.village ?? ""}/>
        <Field label="Kecamatan" name="district" defaultValue={property.district ?? ""}/>
        <Field label="Kota/Kabupaten" name="city" defaultValue={property.city ?? ""}/>
        <Field label="Provinsi" name="province" defaultValue={property.province ?? ""}/>
        <Field label="Kode pos" name="postalCode" defaultValue={property.postalCode ?? ""}/>
        <Field label="Luas tanah (m²)" name="landArea" type="number" defaultValue={property.landArea?.toString() ?? ""}/>
        <Field label="Luas bangunan (m²)" name="buildingArea" type="number" defaultValue={property.buildingArea?.toString() ?? ""}/>
        <label className="text-sm font-medium text-neutral-700 sm:col-span-2 lg:col-span-3">Deskripsi<textarea name="description" rows={3} defaultValue={property.description ?? ""} maxLength={4000} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm"/></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button disabled={saving || property.status === "ARCHIVED"} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving ? "Menyimpan…" : "Simpan perubahan"}</button>{property.status !== "ARCHIVED" && <button type="button" disabled={archiving} onClick={() => void archive()} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"><Archive size={16}/>{archiving ? "Mengarsipkan…" : "Arsipkan properti"}</button>}</div>
      </form>
    </section>
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <Records title="Gedung" count={property.buildings.length} rows={property.buildings.map((item) => ({ title: item.name, code: item.code, detail: item.floors ? `${item.floors} lantai` : item.status }))}/>
      <Records title="Unit" count={property.units.length} rows={property.units.map((item) => ({ title: item.name || item.code, code: item.code, detail: `${labels[item.unitType] ?? item.unitType} · ${labels[item.status] ?? item.status}` }))}/>
      <Records title="Aset" count={property.assets.length} rows={property.assets.map((item) => ({ title: item.name, code: item.code, detail: `${item.category} · ${labels[item.status] ?? item.status}` }))}/>
    </div>
  </main>;
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4"><span className="rounded-xl bg-orange-50 p-2 text-orange-600">{icon}</span><div><p className="text-xs text-neutral-500">{label}</p><p className="text-xl font-bold text-neutral-950">{value}</p></div></div>;
}
function Field({ label, name, defaultValue, required = false, type = "text" }: { label: string; name: string; defaultValue: string; required?: boolean; type?: string }) {
  return <label className="text-sm font-medium text-neutral-700">{label}<input name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} defaultValue={defaultValue} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm"/></label>;
}
function Records({ title, count, rows }: { title: string; count: number; rows: { title: string; code: string; detail: string }[] }) {
  return <section className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-neutral-950">{title}</h2><span className="text-xs text-neutral-500">{count} data</span></div>{rows.length === 0 ? <p className="mt-4 text-sm text-neutral-400">Belum ada {title.toLowerCase()}.</p> : <ul className="mt-3 divide-y divide-neutral-100">{rows.slice(0, 8).map((row) => <li key={row.code} className="py-3"><p className="text-sm font-medium text-neutral-800">{row.title}</p><p className="mt-0.5 text-xs text-neutral-500">{row.code} · {row.detail}</p></li>)}</ul>}</section>;
}
