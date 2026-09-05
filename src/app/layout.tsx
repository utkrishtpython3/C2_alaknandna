import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alaknanda Flash Flood EWS — NRSC / IMD / NDRF",
  description:
    "Operational hyper-local flash flood & debris-flow early-warning controller for the Upper Alaknanda–Dhauliganga basin (Joshimath–Vishnuprayag–Helang gorge, Chamoli).",
  keywords: [
    "flash flood",
    "debris flow",
    "Green-Ampt",
    "FFG",
    "Alaknanda",
    "Uttarakhand",
    "NRSC",
    "NDRF",
    "hydrology",
  ],
  authors: [{ name: "ISRO-NRSC / IMD / NDRF" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Alaknanda Flash Flood EWS",
    description:
      "Hyper-local flash flood & debris-flow early-warning controller",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
