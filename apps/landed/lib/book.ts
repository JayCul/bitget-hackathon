// Order-book arithmetic on a live Bitget snapshot.
export type Level = [number, number]; // [price, qty]

export function mid(bids: Level[], asks: Level[]) {
  return (bids[0]![0] + asks[0]![0]) / 2;
}

/** Market buy of `usd` against the asks: average price, cost vs mid in bps, qty. null if too thin. */
export function walkBuy(asks: Level[], bids: Level[], usd: number) {
  const m = mid(bids, asks);
  let left = usd;
  let qty = 0;
  let worst = asks[0]![0];
  for (const [p, q] of asks) {
    const take = Math.min(left, p * q);
    qty += take / p;
    left -= take;
    worst = p;
    if (left <= 1e-9) break;
  }
  if (left > 1e-9) return null;
  const avg = usd / qty;
  return { avgPrice: avg, qty, worstPrice: worst, costBps: ((avg - m) / m) * 1e4, mid: m };
}

export function spreadBps(bids: Level[], asks: Level[]) {
  const m = mid(bids, asks);
  return ((asks[0]![0] - bids[0]![0]) / m) * 1e4;
}

export function depthUsd(levels: Level[], m: number, withinBps: number) {
  return levels.filter(([p]) => (Math.abs(p - m) / m) * 1e4 <= withinBps).reduce((s, [p, q]) => s + p * q, 0);
}
