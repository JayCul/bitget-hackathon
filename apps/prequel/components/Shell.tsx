"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M4 12h5M9 12l6-6.5M9 12l6 6.5M15 5.5h5M15 18.5h5" stroke="var(--color-cool)" strokeWidth="1.4" fill="none" />
      <circle cx="9" cy="12" r="2.6" fill="var(--color-accent)" />
      <circle cx="20" cy="5.5" r="1.4" fill="var(--color-red)" />
      <circle cx="20" cy="18.5" r="1.4" fill="var(--color-green)" />
    </svg>
  );
}

const NAV = [
  { href: "/theses", label: "Theses" },
  { href: "/replay", label: "Replay" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight" aria-label="Prequel home">
          <Mark />
          Prequel
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = path?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active ? "bg-raised-2 text-fg" : "text-muted hover:text-fg"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1240px] px-5 pt-10 pb-24 md:px-8">{children}</main>
    </>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{children}</div>;
}
