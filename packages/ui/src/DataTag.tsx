export type DataKind =
  | "OBSERVED"
  | "COMPUTED"
  | "ESTIMATED"
  | "BACKTESTED"
  | "SIMULATED"
  | "ENTERED"
  | "AI ESTIMATE"
  | "DEMO"
  | "DEMO REPLAY";

const hints: Record<DataKind, string> = {
  OBSERVED: "Raw value from a named data source",
  COMPUTED: "Calculated in code from observed data",
  ESTIMATED: "Model output from code, not observed",
  BACKTESTED: "Historical replay, not live results",
  SIMULATED: "Simulated execution, nothing was traded",
  ENTERED: "Entered by you, not a market source",
  DEMO: "Sample input for the demo",
  "AI ESTIMATE": "AI estimate, not a calibrated probability",
  "DEMO REPLAY": "Recorded sequence replayed for the demo",
};

export function DataTag({ kind, source, className = "" }: { kind: DataKind; source?: string; className?: string }) {
  const accent = kind === "AI ESTIMATE" || kind === "DEMO REPLAY" || kind === "DEMO";
  return (
    <span
      title={source ? `${hints[kind]}. Source: ${source}` : hints[kind]}
      className={`inline-flex max-w-full items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10px] leading-4 tracking-wider whitespace-nowrap uppercase ${
        accent ? "border-accent/40 text-accent" : "border-line-strong text-muted"
      } ${className}`}
    >
      {kind}
      {source ? <span className="truncate normal-case opacity-70">· {source}</span> : null}
    </span>
  );
}
