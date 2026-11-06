import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAdminSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Internal — Dzaroza Property",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession(await headers());
  if (!session) redirect("/admin/login");

  return <>{children}</>;
}
