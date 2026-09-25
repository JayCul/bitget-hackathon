/** Next weekday 09:00 WAT (08:00 UTC) strictly after `now`. Salary alerts typically land then. */
export function nextPaydayMorning(now = Date.now()): number {
  const d = new Date(now);
  d.setUTCHours(8, 0, 0, 0);
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

export function paydayStart(mode: "now" | "morning", now = Date.now()) {
  return mode === "now" ? now : nextPaydayMorning(now);
}
