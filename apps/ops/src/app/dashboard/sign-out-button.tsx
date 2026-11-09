"use client";
import { signOut } from "next-auth/react";
export function SignOutButton(){return <button onClick={()=>signOut({callbackUrl:"/login"})} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Keluar</button>;}
