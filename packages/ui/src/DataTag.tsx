export type DataKind = "OBSERVED" | "COMPUTED" | "ESTIMATED" | "BACKTESTED" | "AI ESTIMATE" | "DEMO REPLAY";

const hints: Record<DataKind, string> = {
  OBSERVED: "Raw value from a named data source",
  COMPUTED: "Calculated in code from observed data",
  ESTIMATED: "Model output from code, not observed",
  BACKTESTED: "Historical replay, not live results",
  "AI ESTIMATE": "AI estimate, not a calibrated probability",
  "DEMO REPLAY": "Recorded sequence replayed for the demo",
};

export function DataTag({ kind, source, className = "" }: { kind: DataKind; source?: string; className?: string }) {
  const accent = kind === "AI ESTIMATE" || kind === "DEMO REPLAY";
  return (
    <span
      title={source ? `${hints[kind]}. Source: ${source}` : hints[kind]}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10px] leading-4 tracking-wider uppercase ${
        accent ? "border-accent/40 text-accent" : "border-line-strong text-muted"
      } ${className}`}
    >
      {kind}
      {source ? <span className="normal-case opacity-70">· {source}</span> : null}
    </span>
  );
}
