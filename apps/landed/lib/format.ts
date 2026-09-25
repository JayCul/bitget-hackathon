export const wat = (t: number, opts: Intl.DateTimeFormatOptions = { weekday: "short", hour: "2-digit", minute: "2-digit" }) =>
  new Date(t).toLocaleString("en-GB", { timeZone: "Africa/Lagos", hour12: false, ...opts });

export const watTime = (t: number) => wat(t, { hour: "2-digit", minute: "2-digit" });
export const watDay = (t: number) => wat(t, { weekday: "short", day: "numeric", month: "short" });

export const usd2 = (x: number) =>
  x.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usdCents = (x: number) =>
  Math.abs(x) < 1 ? `${(x * 100).toFixed(1)}¢` : usd2(x);
export const bps = (x: number | null | undefined, d = 1) => (x == null ? "n/a" : `${x.toFixed(d)} bps`);
export const ngnFmt = (x: number) => `₦${Math.round(x).toLocaleString("en-US")}`;
