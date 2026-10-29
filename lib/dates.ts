// Demo dates move with today, so a judge opening the demo during judging never sees a fitting in the past.

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** The demo passport was kept three weeks ago, and the demo fitting is in two days at 11:00. */
export function demoDates(now = Date.now()) {
  const d = new Date(now);
  const keptAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 21 * DAY;
  const a = new Date(now + 2 * DAY);
  const appointment = `${a.getUTCFullYear()}-${pad(a.getUTCMonth() + 1)}-${pad(a.getUTCDate())}T11:00`;
  return { keptAt, appointment };
}

/** "21 Oct 2026": the same on the server and in the browser. */
export const dayLabel = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Wed 28 Oct, 11:00" for a local appointment string ("2026-10-28T11:00"), read as written. */
export function appointmentLabel(local: string) {
  const [date, time] = local.split("T");
  const d = new Date(`${date}T00:00Z`);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}, ${time}`;
}
