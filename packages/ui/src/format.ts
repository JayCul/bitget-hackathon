export const pct = (x: number, digits = 1) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
export const bps = (x: number, digits = 1) => `${x.toFixed(digits)} bps`;
export const usd = (x: number, digits = 0) =>
  x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
export const ngn = (x: number) => `₦${Math.round(x).toLocaleString("en-US")}`;
