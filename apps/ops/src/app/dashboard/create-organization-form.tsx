"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CreateOrganizationForm(){
 const [name,setName]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/organizations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Gagal membuat organisasi.");setName("");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Terjadi kesalahan.");}finally{setBusy(false);}}
 return <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={100} required placeholder="Nama organisasi / perusahaan" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"/><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Membuat…":"Buat organisasi"}</button>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}</form>;
}
