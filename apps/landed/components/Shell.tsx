"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M2 16h7l3-6h10M12 10l3 6h7" stroke="var(--color-accent)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="16" r="1.6" fill="var(--color-accent)" />
      <circle cx="17" cy="10" r="1.6" fill="var(--color-accent)" />
    </svg>
  );
}

const NAV = [
  { href: "/plan", label: "Plan" },
  { href: "/replay", label: "Replay" },
];

export function Header({ wide }: { wide?: boolean }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className={`mx-auto flex h-14 items-center justify-between px-4 md:px-6 ${wide ? "max-w-[1180px]" : "max-w-xl"}`}>
        <Link href="/" className="flex items-center gap-2 text-[15px] font-medium tracking-tight" aria-label="Landed home">
          <Mark />
          Landed
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
      <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-28 md:px-6">{children}</main>
    </>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{children}</div>;
}
