/** Next weekday 08:30 WAT (07:30 UTC) strictly after `now`: early-morning alert, before New York pre-market. */
export function nextPaydayMorning(now = Date.now()): number {
  const d = new Date(now);
  d.setUTCHours(7, 30, 0, 0);
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

export function paydayStart(mode: "now" | "morning", now = Date.now()) {
  return mode === "now" ? now : nextPaydayMorning(now);
}
