// Peer groups for pooling analogs. Every ticker here has a Bitget spot rToken (verified 24 Sep 2026).
const SEMIS = ["NVDA", "AMD", "AVGO", "MU", "TSM", "QCOM", "ARM", "MRVL", "AMAT", "LRCX", "INTC", "ASML", "TXN", "SMCI"];

const GROUPS: string[][] = [SEMIS];

/** The ticker first, then up to `max - 1` peers from its group. Unknown tickers stand alone. */
export function universeFor(ticker: string, max = 14): string[] {
  const t = ticker.toUpperCase();
  const group = GROUPS.find((g) => g.includes(t));
  if (!group) return [t];
  return [t, ...group.filter((x) => x !== t)].slice(0, max);
}
