import type { Metadata } from "next";

const title = "Run a Scan — Hatsmash";
const description = "Scan an AI-built website and preview realistic accessibility, performance, SEO, AI-tell, and security findings.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [] },
  twitter: { title, description, images: [] },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
