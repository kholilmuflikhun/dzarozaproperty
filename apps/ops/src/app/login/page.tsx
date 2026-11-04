"use client";

import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user) router.replace("/dashboard");
  }, [session, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Dzaroza Property</p>
        <h1 className="mt-3 text-2xl font-bold">Masuk ke Business OS</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Gunakan akun Google untuk mengakses organisasi yang telah memberikan keanggotaan kepada Anda.</p>
        <button
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })}
          disabled={isPending}
          className="mt-7 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Lanjutkan dengan Google
        </button>
        <p className="mt-5 text-xs leading-5 text-slate-500">Akses organisasi ditentukan oleh keanggotaan di server. Login saja tidak otomatis memberikan akses ke data bisnis.</p>
      </section>
    </main>
  );
}
