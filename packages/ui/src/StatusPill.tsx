export type Status = "WAITING" | "ARMED" | "FIRED" | "EXPIRED" | "LOCKED" | "LIVE" | "REPLAY" | "UNAVAILABLE";

const style: Record<Status, string> = {
  WAITING: "text-muted border-line-strong",
  ARMED: "text-fg border-fg/40",
  FIRED: "text-black bg-accent border-accent",
  EXPIRED: "text-muted/60 border-line line-through",
  LOCKED: "text-accent border-accent/40",
  LIVE: "text-fg border-line-strong",
  REPLAY: "text-accent border-accent/40",
  UNAVAILABLE: "text-muted border-dashed border-line-strong",
};

export function StatusPill({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span
      role="status"
      aria-label={`Status: ${status.toLowerCase()}`}
      className={`inline-flex h-5 items-center rounded-full border px-2 font-mono text-[10px] tracking-wider ${style[status]} ${className}`}
    >
      {status === "ARMED" || status === "LIVE" ? (
        <span aria-hidden className="mr-1.5 size-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {status}
    </span>
  );
}
