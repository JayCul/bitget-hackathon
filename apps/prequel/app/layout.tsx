import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientGlow } from "@desk/ui";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Prequel",
  description: "Know what would change your mind before you trade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <AmbientGlow tone="cool" />
        {children}
      </body>
    </html>
  );
}
