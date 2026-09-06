import type { Metadata } from "next";

const title = "Run a Scan — Hatsmash";
const description = "Review your website’s accessibility, performance, SEO, content quality, and security with actionable findings.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [] },
  twitter: { title, description, images: [] },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
