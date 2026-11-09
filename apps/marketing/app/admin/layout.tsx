import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Internal — Dzaroza Property",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/api/auth/signin?callbackUrl=/admin/upload");

  return <>{children}</>;
}
