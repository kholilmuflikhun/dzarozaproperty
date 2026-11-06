import type { Metadata } from "next";
import AdminSignIn from "@/components/AdminSignIn";

export const metadata: Metadata = {
  title: "Login Admin — Dzaroza Property",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-charcoal-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-charcoal-950">Login Admin</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          Masuk dengan akun Google yang terdaftar sebagai admin.
        </p>
        <AdminSignIn />
      </section>
    </main>
  );
}
