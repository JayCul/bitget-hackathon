import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" aria-label="Landed home" className="group flex items-center gap-2.5">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <circle cx="4" cy="9" r="2.4" fill="var(--color-accent)" />
        <path d="M6.5 9 C 10 9, 11 4, 16 4 M6.5 9 H16 M6.5 9 C 10 9, 11 14, 16 14" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" fill="none" />
      </svg>
      <span className="font-mono text-[13px] font-medium tracking-[0.32em]">LANDED</span>
    </Link>
  );
}

/** Landing navigation: two quiet links and one understated action. */
export function SiteNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 md:px-10">
        <Wordmark />
        <nav aria-label="Main" className="flex items-center gap-2 text-[13px]">
          <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-bg/50 p-1 backdrop-blur-md sm:flex">
            <a href="#how" className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-fg">
              How it works
            </a>
            <Link href="/replay" className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-fg">
              History
            </Link>
          </span>
          <Link href="/plan" className="rounded-full bg-fg px-4 py-2 font-medium text-black transition-colors hover:bg-accent-2">
            Build a plan
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** App navigation: wordmark and one way out. */
export function AppNav({ right }: { right?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-5 md:px-10">
        <Wordmark />
        {right ? (
          <Link href={right.href} className="text-sm text-muted transition-colors hover:text-fg">
            {right.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
