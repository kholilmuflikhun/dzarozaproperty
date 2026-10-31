import type { Metadata } from "next";
import ApprovalClient from "./approval-client";

export const metadata: Metadata = {
  title: "Persetujuan Penawaran | Dzaroza Property",
  robots: { index: false, follow: false },
};

export default async function QuotationApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ApprovalClient token={token} />;
}
