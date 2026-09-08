import { TZDate } from "@date-fns/tz";
import { format, parseISO } from "date-fns";

/**
 * Every event time in Gradus is a Maldives wall-clock time (events.timezone
 * is always 'Indian/Maldives'). Instants are stored as UTC; this module is
 * the ONE place that converts between the two, so the same time renders
 * identically whether it's formatted on the server (Vercel = UTC) or in a
 * practitioner's browser (any zone).
 *
 * Bug this replaced (found 2026-09-08): the admin form posted the raw
 * datetime-local string, Postgres read it as UTC, and client components
 * then rendered it in the browser zone — so an 8 pm event showed as
 * 01:00 the next day on phones while the server page said 20:00.
 */
export const EVENT_TZ = "Indian/Maldives";

function toDate(d: Date | string): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

/** The instant re-expressed in Maldives time (date-fns formats it as such). */
export function inMvt(d: Date | string): TZDate {
  return new TZDate(toDate(d), EVENT_TZ);
}

/** `format()` but always in Maldives time, regardless of runtime zone. */
export function formatMvt(d: Date | string, pattern: string): string {
  return format(inMvt(d), pattern);
}

/** Calendar-day test in Maldives time (not the browser's day). */
export function isTodayMvt(d: Date | string): boolean {
  return formatMvt(d, "yyyy-MM-dd") === formatMvt(new Date(), "yyyy-MM-dd");
}

/**
 * A `datetime-local` value ("2026-09-08T20:00") typed as Maldives time →
 * UTC ISO instant for storage. Returns null for anything unparseable.
 */
export function fromMvtLocal(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const instant = new TZDate(y, mo - 1, d, h, mi, 0, EVENT_TZ);
  // TZDate.toISOString() keeps the +05:00 offset — normalise to a UTC instant.
  return Number.isNaN(instant.getTime())
    ? null
    : new Date(instant.getTime()).toISOString();
}

/**
 * UTC ISO instant → `datetime-local` value in Maldives time (for
 * pre-filling edit forms).
 */
export function toMvtLocal(d: Date | string): string {
  return formatMvt(d, "yyyy-MM-dd'T'HH:mm");
}
