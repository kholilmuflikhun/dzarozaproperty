"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

export function CreateOrganizationForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organizationName = name.trim();

    if (organizationName.length < 2) {
      setError("Nama organisasi minimal 2 karakter.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: organizationName }),
      });
      const data: { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Gagal membuat organisasi. Silakan coba lagi.");
      }

      setName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label htmlFor="organization-name" className="sr-only">
            Nama organisasi
          </label>
          <input
            id="organization-name"
            name="organizationName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={100}
            required
            autoComplete="organization"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "organization-name-error" : "organization-name-hint"}
            placeholder="Contoh: PT Dzaroza Properti"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
          <p id="organization-name-hint" className="mt-2 text-xs text-slate-400">
            Gunakan nama perusahaan atau unit bisnis Anda.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus size={17} aria-hidden="true" />
          )}
          {busy ? "Membuat organisasi..." : "Buat organisasi"}
        </button>
      </div>
      {error ? (
        <p id="organization-name-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
