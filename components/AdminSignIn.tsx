"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function AdminSignIn() {
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/admin/upload",
    });
    if (result.error) {
      setError("Login Google gagal. Silakan coba lagi.");
    }
  }

  return (
    <div className="mt-6">
      {isPending ? (
        <p className="text-sm text-charcoal-500">Memeriksa sesi...</p>
      ) : session?.user ? (
        <div>
          <p className="text-sm text-red-700">
            Akun {session.user.email} tidak memiliki akses admin.
          </p>
          <button
            type="button"
            onClick={() => authClient.signOut()}
            className="mt-4 rounded-full border border-charcoal-200 px-5 py-3 text-sm font-semibold text-charcoal-800 hover:border-orange-500 hover:text-orange-700"
          >
            Keluar dan gunakan akun lain
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={signIn}
          className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-charcoal-950 hover:bg-orange-400"
        >
          Masuk dengan Google
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
