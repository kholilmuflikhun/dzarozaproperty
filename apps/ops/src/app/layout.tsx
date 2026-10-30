import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Dzaroza Property OS", description: "Project & Business Operating System" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="id"><body>{children}</body></html>; }
