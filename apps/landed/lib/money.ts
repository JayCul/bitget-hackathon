// Payday arithmetic, in code. The FX rate is the user's own input: Bitget has no NGN market.
export type Bill = { id: string; label: string; ngn: number };

export function investable(salaryNgn: number, bills: Bill[], ngnPerUsd: number) {
  const untouched = bills.reduce((s, b) => s + Math.max(0, b.ngn), 0);
  const ngn = Math.max(0, salaryNgn - untouched);
  return { untouchedNgn: untouched, investableNgn: ngn, investableUsd: ngnPerUsd > 0 ? ngn / ngnPerUsd : 0 };
}

/** Split USD across a basket by weight; weights need not sum to 1. */
export function allocate(usd: number, basket: { ticker: string; weight: number }[]) {
  const total = basket.reduce((s, b) => s + Math.max(0, b.weight), 0);
  if (!total) return [];
  return basket.map((b) => ({ ticker: b.ticker, usd: (usd * Math.max(0, b.weight)) / total }));
}
