import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientGlow } from "@desk/ui";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Landed",
  description: "Your salary landed. Don't waste the spread.",
};

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <AmbientGlow tone="warm" />
        {children}
      </body>
    </html>
  );
}
