/**
 * Dates, written the way Lebanon writes them: day/month/year.
 *
 * Every call site used to be a bare `toLocaleDateString()` with no locale,
 * which means "whatever the device is set to" — the same order, on the same
 * screen, rendering as 20/09/2026 for one driver and 9/20/2026 for the next.
 * These helpers take the choice away from the device.
 *
 * `en-GB` is the vehicle rather than the intent: it is simply the built-in
 * locale whose numeric date is already day/month/year, and the parts are
 * assembled by hand afterwards so a runtime with a trimmed ICU (Hermes on a
 * small Android build) still produces the right order rather than falling back
 * to US format silently.
 */

const TWO = (n: number) => String(n).padStart(2, "0");

/** Anything a stored timestamp can be, plus the failures. */
export type DateLike = string | number | Date | null | undefined;

function toDate(value: DateLike): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `20/09/2026`. Empty string when there is no usable date. */
export function formatDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  return `${TWO(d.getDate())}/${TWO(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `20/09/2026 14:05`. 24-hour, because a delivery log is read, not spoken. */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  return `${formatDate(d)} ${TWO(d.getHours())}:${TWO(d.getMinutes())}`;
}

/** `14:05` — for rows that already say which day they belong to. */
export function formatTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  return `${TWO(d.getHours())}:${TWO(d.getMinutes())}`;
}

/** `20/09` — chart axes and other places where the year is noise. */
export function formatDayMonth(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  return `${TWO(d.getDate())}/${TWO(d.getMonth() + 1)}`;
}
